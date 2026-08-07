import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.58.0";
import { hybridRetrieve } from "../_shared/rag/hybridRetriever.ts";
import type { RetrievalCandidate, RetrievalFilters } from "../_shared/rag/types.ts";
import { validateRequest, generateRequestId, badRequest, internalError, logFailure, logSuccess } from "../_shared/validation/index.ts";
import { ForgeAIRequestSchema } from "../_shared/validation/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Supabase = SupabaseClient;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "RAG query failed.";
}

function classifyIntent(query: string): string {
  const lower = query.toLowerCase();
  if (/\b(approved|approval|decision)\b/.test(lower)) return "approval_lookup";
  if (/\b(price|pricing|cost)\b/.test(lower)) return "pricing_lookup";
  if (/\b(who|person|team|client|relationship|works on)\b/.test(lower)) return "relationship_lookup";
  if (/\b(compare|difference|versus|vs\.)\b/.test(lower)) return "comparison";
  return "organizational_knowledge_query";
}

async function defaultOrganization(supabase: Supabase): Promise<{ id: string; slug: string }> {
  const { data, error } = await supabase.from("organizations").select("id, slug").eq("slug", "default").single();
  if (error) throw error;
  return data;
}

function cleanFilters(value: unknown, organizationId: string): RetrievalFilters {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const strings = (field: string) => Array.isArray(input[field])
    ? input[field].filter((entry): entry is string => typeof entry === "string" && entry.length < 200).slice(0, 50)
    : undefined;
  return {
    organizationId,
    documentIds: strings("documentIds"),
    sourceTypes: strings("sourceTypes"),
    department: typeof input.department === "string" ? input.department.slice(0, 120) : undefined,
    tags: strings("tags"),
    dateFrom: typeof input.dateFrom === "string" ? input.dateFrom : undefined,
    dateTo: typeof input.dateTo === "string" ? input.dateTo : undefined,
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata as Record<string, unknown> : undefined,
    entityIds: strings("entityIds"),
  };
}

function evidenceConfidence(evidence: RetrievalCandidate[]) {
  if (!evidence.length) return { level: "low" as const, score: 0, basis: "No indexed evidence matched this query." };
  const average = evidence.reduce((sum, item) => sum + (item.rerankScore ?? item.fusedScore ?? 0), 0) / evidence.length;
  const score = Math.max(1, Math.min(100, Math.round(average * 100)));
  return {
    level: score >= 65 ? "high" as const : score >= 38 ? "medium" as const : "low" as const,
    score,
    basis: `Derived from ${evidence.length} reranked evidence chunk${evidence.length === 1 ? "" : "s"}; it is not a model accuracy claim.`,
  };
}

function compactExcerpt(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 300);
}

function evidenceOnlyAnswer(query: string, evidence: RetrievalCandidate[]) {
  const confidence = evidenceConfidence(evidence);
  if (!evidence.length) {
    return {
      directAnswer: "No indexed organizational evidence matched this query. Try different wording, remove filters, or upload the relevant source.",
      keyFindings: [],
      probableCauses: [],
      recommendedActions: ["Review the retrieval debug panel and broaden the query if appropriate."],
      riskNote: "No answer was synthesized because there is no supporting evidence.",
      confidence,
      fallback: true,
    };
  }
  return {
    directAnswer: `Gemini generation is unavailable, so this response is an evidence-only retrieval result for: ${query}`,
    keyFindings: evidence.slice(0, 5).map((item) => ({ finding: compactExcerpt(item.content), evidenceIds: [item.chunkId] })),
    probableCauses: [],
    recommendedActions: ["Review the cited chunks before making a decision."],
    riskNote: "No unsupported synthesis was generated while the language model is unavailable.",
    confidence,
    fallback: true,
  };
}

function validateGenerated(value: unknown, evidence: RetrievalCandidate[]) {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const findings = Array.isArray(candidate.keyFindings) ? candidate.keyFindings : [];
  const actions = Array.isArray(candidate.recommendedActions) ? candidate.recommendedActions : [];
  const causes = Array.isArray(candidate.probableCauses) ? candidate.probableCauses : [];
  return {
    directAnswer: typeof candidate.directAnswer === "string" ? candidate.directAnswer.slice(0, 5000) : "The retrieved evidence does not support a concise answer.",
    keyFindings: findings.filter((item): item is string => typeof item === "string").slice(0, 8).map((finding, index) => ({
      finding: finding.slice(0, 1000), evidenceIds: evidence[index] ? [evidence[index].chunkId] : [],
    })),
    probableCauses: causes.filter((item): item is Record<string, unknown> => item && typeof item === "object" && typeof item.cause === "string").slice(0, 5).map((item) => ({
      cause: String(item.cause).slice(0, 500),
      confidence: item.confidence === "high" || item.confidence === "medium" || item.confidence === "low" ? item.confidence : "low",
      evidenceIds: evidence.slice(0, 2).map((row) => row.chunkId),
    })),
    recommendedActions: actions.filter((item): item is string => typeof item === "string").slice(0, 8).map((item) => item.slice(0, 500)),
    riskNote: typeof candidate.riskNote === "string" ? candidate.riskNote.slice(0, 1000) : "",
    confidence: evidenceConfidence(evidence),
    fallback: false,
  };
}

async function synthesizeWithGemini(query: string, evidence: RetrievalCandidate[]) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;
  const context = evidence.map((item, index) => [
    `[E${index + 1}] document=${item.documentName}; chunk=${item.chunkId}; page=${item.pageNumber ?? "unknown"}; section=${item.sectionTitle ?? "unknown"}`,
    item.content,
  ].join("\n")).join("\n\n");
  const prompt = `Answer the user's question only from the evidence below. Do not use outside knowledge. If evidence is insufficient, say so. Do not invent citations, names, dates, approvals, prices, or confidence. Return JSON only with this schema: {directAnswer:string,keyFindings:string[],probableCauses:[{cause:string,confidence:"high"|"medium"|"low"}],recommendedActions:string[],riskNote:string}.\n\nQUESTION:\n${query}\n\nEVIDENCE:\n${context}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const raw = (await response.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(raw);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function recordMemory(
  supabase: Supabase,
  organizationId: string,
  taskId: string,
  executionId: string,
  query: string,
  answer: Record<string, unknown>,
  retrieval: Awaited<ReturnType<typeof hybridRetrieve>>,
  latencyMs: number,
) {
  const evidence = retrieval.citations;
  const initial = {
    task_id: taskId,
    organization_id: organizationId,
    original_query: query,
    rewritten_queries: retrieval.debug.rewrittenQueries,
    retrieved_chunk_ids: evidence.map((citation) => citation.chunkId),
    discovered_entities: retrieval.discoveredEntities,
    current_plan: ["Analyze query", "Retrieve hybrid evidence", "Rerank evidence", "Synthesize grounded response"],
    intermediate_outputs: { retrievalDebug: retrieval.debug },
    current_status: "retrieving",
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  const { error: workingError } = await supabase.from("working_memory").upsert(initial, { onConflict: "task_id" });
  if (workingError) throw workingError;
  const { error: completeError } = await supabase.from("working_memory").update({
    current_status: "completed",
    intermediate_outputs: { retrievalDebug: retrieval.debug, answer },
  }).eq("task_id", taskId);
  if (completeError) throw completeError;
  const { error: episodicError } = await supabase.from("episodic_memory").insert({
    execution_id: executionId,
    task_id: taskId,
    organization_id: organizationId,
    query,
    agents_used: ["hybrid-rag", answer.fallback ? "evidence-only" : "gemini-grounded"],
    retrieved_evidence: evidence,
    final_output: answer,
    success: retrieval.evidence.length > 0,
    confidence: Number((Number((answer.confidence as { score?: number })?.score ?? 0) / 100).toFixed(3)),
    latency_ms: latencyMs,
    token_usage: null,
    cost_estimate: null,
    debug_payload: retrieval.debug,
  });
  if (episodicError) throw episodicError;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") {
    const err = badRequest("Method not allowed");
    return json(err, 405);
  }
  const startedAt = Date.now();
  const requestId = generateRequestId();
  const endpoint = "forge-ai";
  const context = { requestId, endpoint };
  try {
    const rawBody = await request.json();
    const parsed = validateRequest(rawBody, ForgeAIRequestSchema, requestId);
    if (!parsed.ok) {
      logFailure(context, { code: "VALIDATION_ERROR", validationErrors: parsed.error.details, latencyMs: Date.now() - startedAt });
      return json(parsed.error, 400);
    }
    const body = parsed.data;
    const query = body.query.trim();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const organization = await defaultOrganization(supabase);
    const filters = cleanFilters(body.filters, organization.id);
    if (typeof body.assetId === "string") {
      const { data: linkedDocuments } = await supabase.from("documents").select("id").eq("organization_id", organization.id).eq("linked_asset_id", body.assetId);
      filters.documentIds = [...new Set([...(filters.documentIds ?? []), ...(linkedDocuments ?? []).map((document: { id: string }) => document.id)])];
    }
    const retrieval = await hybridRetrieve(supabase, query, filters);
    if (body.mode === "search") {
      logSuccess(context, Date.now() - startedAt, { mode: "search", evidence: retrieval.evidence.length });
      return json({ success: true, requestId, retrieval });
    }
    const generated = await synthesizeWithGemini(query, retrieval.evidence);
    const answer = generated ? validateGenerated(generated, retrieval.evidence) : evidenceOnlyAnswer(query, retrieval.evidence);
    const sources = retrieval.citations.map((citation) => ({
      documentId: citation.documentId,
      documentName: citation.documentName,
      chunkId: citation.chunkId,
      page: citation.pageNumber,
      section: citation.sectionTitle ?? "Document",
      sourceType: citation.sourceType,
      similarityScore: citation.similarityScore,
      excerpt: compactExcerpt(retrieval.evidence.find((item) => item.chunkId === citation.chunkId)?.content ?? ""),
    }));
    const taskId = crypto.randomUUID();
    const executionId = crypto.randomUUID();
    await recordMemory(supabase, organization.id, taskId, executionId, query, answer, retrieval, Date.now() - startedAt);
    const agentTrace = [
      { agent: "Query Analysis", role: "retrieval planning", action: `Intent: ${classifyIntent(query)}; queries: ${retrieval.debug.rewrittenQueries.length}`, evidenceCount: 0, status: "completed" },
      { agent: "Hybrid Retriever", role: "vector + lexical + metadata + graph", action: `RRF fused ${retrieval.debug.fusionResults.length} candidates and reranked ${retrieval.evidence.length}`, evidenceCount: retrieval.evidence.length, status: "completed" },
      { agent: generated ? "Grounded Gemini" : "Evidence-only mode", role: "answer synthesis", action: generated ? "Generated from final retrieved context." : "No model synthesis; returned retrieved evidence only.", evidenceCount: retrieval.evidence.length, status: generated ? "completed" : "skipped" },
      { agent: "Shared Memory", role: "working + episodic record", action: "Recorded this execution with retrieval debug data.", evidenceCount: retrieval.evidence.length, status: "completed" },
    ];
    logSuccess(context, Date.now() - startedAt, { mode: "generate", evidence: retrieval.evidence.length, memory: true });
    return json({
      success: true,
      requestId,
      answer: {
        ...answer,
        sources,
        citations: retrieval.citations,
        intent: classifyIntent(query),
        agentTrace,
        retrieval: {
          vector: { count: retrieval.debug.vectorResults.length, sources: retrieval.debug.vectorResults.map((item) => item.documentName) },
          lexical: { count: retrieval.debug.lexicalResults.length, sources: retrieval.debug.lexicalResults.map((item) => item.documentName) },
          metadata: { count: retrieval.debug.metadataResults.length, sources: retrieval.debug.metadataResults.map((item) => item.documentName) },
          knowledgeGraph: { count: retrieval.debug.graphResults.length, sources: retrieval.debug.graphResults.map((item) => item.documentName) },
        },
        retrievalDebug: retrieval.debug,
        memory: { taskId, executionId, requestId },
      },
    });
  } catch (error) {
    console.error("forge-ai", error);
    logFailure(context, { code: "INTERNAL_ERROR", latencyMs: Date.now() - startedAt });
    const err = internalError(message(error), requestId);
    return json(err, 500);
  }
});
