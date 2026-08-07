import { embedQuery } from "./embeddingService.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  RETRIEVAL_DEFAULTS,
  type HybridRetrievalResult,
  type RetrievalCandidate,
  type RetrievalDebug,
  type RetrievalFilters,
} from "./types.ts";

type Supabase = SupabaseClient;

interface RawRow {
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  metadata: Record<string, unknown> | null;
  page_number: number | null;
  section_title: string | null;
  heading_path: string[] | null;
  source_type: string | null;
  similarity?: number;
  lexical_score?: number;
  metadata_score?: number;
  graph_score?: number;
  traversal?: string[];
}

function candidate(row: RawRow): RetrievalCandidate {
  return {
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentName: row.document_name,
    content: row.content,
    metadata: row.metadata ?? {},
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    headingPath: row.heading_path ?? [],
    sourceType: row.source_type,
    semanticScore: row.similarity,
    lexicalScore: row.lexical_score,
    metadataScore: row.metadata_score,
    graphScore: row.graph_score,
    retrievalRanks: {},
    traversal: row.traversal,
  };
}

export function retrievalQueries(query: string): string[] {
  const queries = new Set([query.trim()]);
  const normalized = query.toLowerCase();
  if (/\b(latest|current|newest)\b/.test(normalized)) queries.add(query.replace(/\b(latest|current|newest)\b/gi, "approved"));
  if (/\bapproved\b/.test(normalized) && /\b(product|feature|price|campaign|launch)\b/.test(normalized)) {
    queries.add(query.replace(/\bapproved\b/gi, "decision"));
  }
  return [...queries].filter((item) => item.length >= 3).slice(0, 3);
}

function rpcFilters(filters: RetrievalFilters) {
  return {
    p_organization_id: filters.organizationId,
    p_document_ids: filters.documentIds?.length ? filters.documentIds : null,
    p_source_types: filters.sourceTypes?.length ? filters.sourceTypes : null,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
    p_metadata_filter: filters.metadata ?? {},
  };
}

async function callRpc(supabase: Supabase, name: string, params: Record<string, unknown>): Promise<RawRow[]> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return (data ?? []) as RawRow[];
}

function assignRanks(items: RetrievalCandidate[], method: "semantic" | "lexical" | "metadata" | "graph"): RetrievalCandidate[] {
  return items.map((item, index) => ({ ...item, retrievalRanks: { ...item.retrievalRanks, [method]: index + 1 } }));
}

function mergeCandidates(lists: Array<{ method: "semantic" | "lexical" | "metadata" | "graph"; items: RetrievalCandidate[] }>): RetrievalCandidate[] {
  const merged = new Map<string, RetrievalCandidate>();
  for (const { items } of lists) {
    for (const item of items) {
      const current = merged.get(item.chunkId);
      if (!current) {
        merged.set(item.chunkId, { ...item });
        continue;
      }
      current.semanticScore = Math.max(current.semanticScore ?? 0, item.semanticScore ?? 0) || undefined;
      current.lexicalScore = Math.max(current.lexicalScore ?? 0, item.lexicalScore ?? 0) || undefined;
      current.metadataScore = Math.max(current.metadataScore ?? 0, item.metadataScore ?? 0) || undefined;
      current.graphScore = Math.max(current.graphScore ?? 0, item.graphScore ?? 0) || undefined;
      current.retrievalRanks = { ...current.retrievalRanks, ...item.retrievalRanks };
      current.traversal = [...new Set([...(current.traversal ?? []), ...(item.traversal ?? [])])];
    }
  }
  return [...merged.values()];
}

function normalize(values: Array<number | undefined>): Map<number, number> {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const low = Math.min(...usable, 0);
  const high = Math.max(...usable, 1);
  return new Map(values.map((value, index) => [index, typeof value === "number" ? (value - low) / Math.max(high - low, 0.000001) : 0]));
}

export function fuse(items: RetrievalCandidate[]): RetrievalCandidate[] {
  const semantic = normalize(items.map((item) => item.semanticScore));
  const lexical = normalize(items.map((item) => item.lexicalScore));
  const graph = normalize(items.map((item) => item.graphScore));
  const metadata = normalize(items.map((item) => item.metadataScore));
  return items.map((item, index) => {
    const ranks = item.retrievalRanks;
    const rrf = (
      (ranks.semantic ? RETRIEVAL_DEFAULTS.fusionWeights.semantic / (RETRIEVAL_DEFAULTS.rrfK + ranks.semantic) : 0) +
      (ranks.lexical ? RETRIEVAL_DEFAULTS.fusionWeights.lexical / (RETRIEVAL_DEFAULTS.rrfK + ranks.lexical) : 0) +
      (ranks.graph ? RETRIEVAL_DEFAULTS.fusionWeights.graph / (RETRIEVAL_DEFAULTS.rrfK + ranks.graph) : 0) +
      (ranks.metadata ? RETRIEVAL_DEFAULTS.fusionWeights.metadata / (RETRIEVAL_DEFAULTS.rrfK + ranks.metadata) : 0)
    );
    // Weighted RRF is the base. Component boosts retain score transparency and
    // make graph/metadata evidence meaningful without pretending the weights are learned.
    const componentBoost = 0.0025 * semantic.get(index)! + 0.0015 * lexical.get(index)! + 0.002 * graph.get(index)! + 0.001 * metadata.get(index)!;
    return { ...item, fusedScore: rrf + componentBoost };
  }).sort((left, right) => (right.fusedScore ?? 0) - (left.fusedScore ?? 0));
}

function queryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().match(/[a-z0-9-]{3,}/g) ?? [])];
}

export function rerank(query: string, candidates: RetrievalCandidate[]): RetrievalCandidate[] {
  const terms = queryTerms(query);
  const fused = normalize(candidates.map((candidate) => candidate.fusedScore));
  return candidates.map((item, index) => {
    const haystack = `${item.sectionTitle ?? ""}\n${item.headingPath.join(" ")}\n${item.content}`.toLowerCase();
    const matched = terms.filter((term) => haystack.includes(term)).length;
    const coverage = terms.length ? matched / terms.length : 0;
    const phrase = haystack.includes(query.trim().toLowerCase()) ? 1 : 0;
    const headingMatches = terms.filter((term) => `${item.sectionTitle ?? ""} ${item.headingPath.join(" ")}`.toLowerCase().includes(term)).length / Math.max(terms.length, 1);
    const rerankScore = 0.5 * fused.get(index)! + 0.32 * coverage + 0.12 * phrase + 0.06 * headingMatches;
    return { ...item, rerankScore };
  }).sort((left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0));
}

function normalizedContent(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

function jaccard(left: string, right: string): number {
  const leftSet = new Set(left.split(" ").filter(Boolean));
  const rightSet = new Set(right.split(" ").filter(Boolean));
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  return intersection / Math.max(new Set([...leftSet, ...rightSet]).size, 1);
}

export function deduplicate(candidates: RetrievalCandidate[]): RetrievalCandidate[] {
  const selected: RetrievalCandidate[] = [];
  const exact = new Set<string>();
  for (const candidate of candidates) {
    const content = normalizedContent(candidate.content);
    if (!content || exact.has(content)) continue;
    const overlapping = selected.some((existing) =>
      existing.documentId === candidate.documentId
      && existing.pageNumber === candidate.pageNumber
      && jaccard(normalizedContent(existing.content), content) >= 0.85,
    );
    if (!overlapping) {
      exact.add(content);
      selected.push(candidate);
    }
  }
  return selected;
}

export async function hybridRetrieve(
  supabase: Supabase,
  query: string,
  filters: RetrievalFilters,
): Promise<HybridRetrievalResult> {
  const rewrittenQueries = retrievalQueries(query);
  const warnings: string[] = [];
  const baseParams = rpcFilters(filters);
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await embedQuery(query);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Semantic retrieval is unavailable.");
  }

  const vectorPromise = queryEmbedding
    ? callRpc(supabase, "match_document_chunks", {
      ...baseParams,
      p_query_embedding: `[${queryEmbedding.join(",")}]`,
      p_match_count: RETRIEVAL_DEFAULTS.vectorCandidates,
      p_match_threshold: RETRIEVAL_DEFAULTS.semanticThreshold,
    })
    : Promise.resolve([]);
  const lexicalPromise = Promise.all(rewrittenQueries.map((retrievalQuery) => callRpc(supabase, "match_document_chunks_lexical", {
    ...baseParams,
    p_query: retrievalQuery,
    p_match_count: RETRIEVAL_DEFAULTS.lexicalCandidates,
  }))).then((groups) => groups.flat());
  const metadataPromise = callRpc(supabase, "match_metadata_document_chunks", {
    ...baseParams,
    p_match_count: RETRIEVAL_DEFAULTS.metadataCandidates,
    p_department: filters.department ?? null,
    p_tags: filters.tags?.length ? filters.tags : null,
  });
  const graphPromise = Promise.all(rewrittenQueries.map((retrievalQuery) => callRpc(supabase, "match_graph_document_chunks", {
    p_query: retrievalQuery,
    p_organization_id: filters.organizationId,
    p_match_count: RETRIEVAL_DEFAULTS.graphCandidates,
    p_max_hops: RETRIEVAL_DEFAULTS.maxGraphHops,
  }))).then((groups) => groups.flat());

  const settled = await Promise.allSettled([vectorPromise, lexicalPromise, metadataPromise, graphPromise]);
  const [vectorRows, lexicalRows, metadataRows, graphRows] = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    warnings.push(["vector", "lexical", "metadata", "graph"][index] + ` retrieval failed: ${String(result.reason)}`);
    return [] as RawRow[];
  });

  const vectorResults = assignRanks(vectorRows.map(candidate).sort((left, right) => (right.semanticScore ?? 0) - (left.semanticScore ?? 0)), "semantic");
  const lexicalResults = assignRanks(lexicalRows.map(candidate).sort((left, right) => (right.lexicalScore ?? 0) - (left.lexicalScore ?? 0)), "lexical");
  const metadataResults = assignRanks(metadataRows.map(candidate), "metadata");
  const graphResults = assignRanks(graphRows.map(candidate).sort((left, right) => (right.graphScore ?? 0) - (left.graphScore ?? 0)), "graph");
  const fusionResults = fuse(mergeCandidates([
    { method: "semantic", items: vectorResults },
    { method: "lexical", items: lexicalResults },
    { method: "metadata", items: metadataResults },
    { method: "graph", items: graphResults },
  ])).slice(0, RETRIEVAL_DEFAULTS.fusionCandidates);
  const finalResults = deduplicate(rerank(query, fusionResults)).slice(0, RETRIEVAL_DEFAULTS.finalEvidence);
  const debug: RetrievalDebug = {
    query,
    rewrittenQueries,
    filters,
    embeddingCreated: !!queryEmbedding,
    embeddingModel: "gemini-embedding-001 (768d)",
    warnings,
    vectorResults,
    lexicalResults,
    metadataResults,
    graphResults,
    fusionResults,
    finalResults,
  };
  return {
    evidence: finalResults,
    citations: finalResults.map((item) => ({
      documentId: item.documentId,
      documentName: item.documentName,
      chunkId: item.chunkId,
      pageNumber: item.pageNumber,
      sectionTitle: item.sectionTitle,
      similarityScore: item.semanticScore ?? item.rerankScore ?? null,
      sourceType: item.sourceType,
    })),
    debug,
    discoveredEntities: [...new Set(graphResults.flatMap((item) => item.traversal ?? []))],
  };
}
