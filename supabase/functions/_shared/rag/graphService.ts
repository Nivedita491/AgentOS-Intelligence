import { ENTITY_TYPES, RELATIONSHIP_TYPES, type SemanticChunk } from "./types.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.58.0";

type Supabase = SupabaseClient;
type StoredEntity = { id: string; canonical_name: string; entity_type: string };

interface ExtractedEntity {
  chunkIndex: number;
  type: string;
  canonicalName: string;
  aliases: string[];
  description?: string;
  confidence: number;
}

interface ExtractedRelationship {
  chunkIndex: number;
  source: string;
  target: string;
  type: string;
  evidence: string;
  confidence: number;
}

interface GraphFacts {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

export interface GraphBuildSummary {
  entities: string[];
  relationshipCount: number;
  warnings: string[];
}

function normalizeEntityName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function clampConfidence(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.5;
}

function validateFacts(value: unknown, batchSize: number): GraphFacts {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const entities = Array.isArray(input.entities) ? input.entities : [];
  const relationships = Array.isArray(input.relationships) ? input.relationships : [];
  return {
    entities: entities.flatMap((entry): ExtractedEntity[] => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const type = typeof item.type === "string" ? item.type.trim() : "";
      const canonicalName = typeof item.canonicalName === "string" ? item.canonicalName.trim() : "";
      const chunkIndex = Number(item.chunkIndex);
      if (!ENTITY_TYPES.has(type) || !canonicalName || canonicalName.length > 180 || !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= batchSize) return [];
      const aliases = Array.isArray(item.aliases)
        ? item.aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0).slice(0, 10)
        : [];
      return [{
        chunkIndex,
        type,
        canonicalName,
        aliases,
        description: typeof item.description === "string" ? item.description.slice(0, 600) : undefined,
        confidence: clampConfidence(item.confidence),
      }];
    }),
    relationships: relationships.flatMap((entry): ExtractedRelationship[] => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const source = typeof item.source === "string" ? item.source.trim() : "";
      const target = typeof item.target === "string" ? item.target.trim() : "";
      const type = typeof item.type === "string" ? item.type.trim() : "";
      const evidence = typeof item.evidence === "string" ? item.evidence.trim() : "";
      const chunkIndex = Number(item.chunkIndex);
      if (!source || !target || !RELATIONSHIP_TYPES.has(type) || !evidence || evidence.length > 1000 || !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= batchSize) return [];
      return [{ chunkIndex, source, target, type, evidence, confidence: clampConfidence(item.confidence) }];
    }),
  };
}

async function extractFactsWithGemini(chunks: SemanticChunk[]): Promise<GraphFacts> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured; only deterministic evidence entities can be added.");
  const evidence = chunks.map((chunk, index) => ({
    chunkIndex: index,
    section: chunk.sectionTitle,
    content: chunk.content.slice(0, 6000),
  }));
  const prompt = `Extract an evidence-backed organizational knowledge graph from the supplied chunks. Return JSON only.
Allowed entity types: ${[...ENTITY_TYPES].join(", ")}.
Allowed relationship types: ${[...RELATIONSHIP_TYPES].join(", ")}.
Schema: {entities:[{chunkIndex,type,canonicalName,aliases:string[],description?,confidence:0..1}],relationships:[{chunkIndex,source,target,type,evidence,confidence:0..1}]}.
Every relationship must be explicitly stated by its referenced chunk. Never infer facts, affiliations, approvals, or dates. Normalize superficial variants (for example, Open AI / OPENAI -> OpenAI) but retain the source display spelling as an alias.
CHUNKS: ${JSON.stringify(evidence)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) throw new Error(`Graph extraction failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const raw = (await response.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
  try { return validateFacts(JSON.parse(raw), chunks.length); } catch { throw new Error("Graph extraction returned invalid JSON."); }
}

function deterministicFacts(chunks: SemanticChunk[]): GraphFacts {
  const entities: ExtractedEntity[] = [];
  const relationships: ExtractedRelationship[] = [];
  for (const [chunkIndex, chunk] of chunks.entries()) {
    const tags = new Set(chunk.content.match(/\b[A-Z]{1,4}-\d{1,4}\b/g) ?? []);
    for (const tag of tags) {
      entities.push({ chunkIndex, type: "Asset", canonicalName: tag, aliases: [], confidence: 1 });
    }
  }
  return { entities, relationships };
}

async function upsertEntity(
  supabase: Supabase,
  organizationId: string,
  entity: Omit<ExtractedEntity, "chunkIndex">,
): Promise<StoredEntity> {
  const normalizedName = normalizeEntityName(entity.canonicalName);
  const { data, error } = await supabase
    .from("entities")
    .upsert({
      organization_id: organizationId,
      entity_type: entity.type,
      ontology_class: entity.type,
      name: entity.canonicalName,
      canonical_name: entity.canonicalName,
      normalized_name: normalizedName,
      aliases: [...new Set(entity.aliases.map((alias) => alias.trim()).filter(Boolean))],
      description: entity.description ?? null,
      confidence: entity.confidence,
      metadata_json: { source: "rag-ingest" },
    }, { onConflict: "organization_id,entity_type,normalized_name" })
    .select()
    .single();
  if (error) throw error;
  return data as StoredEntity;
}

export async function buildGraphForDocument(
  supabase: Supabase,
  organizationId: string,
  document: { id: string; original_name: string },
  chunks: Array<SemanticChunk & { id: string }>,
): Promise<GraphBuildSummary> {
  const warnings: string[] = [];
  const documentEntity = await upsertEntity(supabase, organizationId, {
    type: "Document",
    canonicalName: document.original_name,
    aliases: [],
    description: "Organizational source document",
    confidence: 1,
  });
  let facts: GraphFacts;
  let usedDeterministicFallback = false;
  try {
    facts = { entities: [], relationships: [] };
    for (let index = 0; index < chunks.length; index += 6) {
      const extracted = await extractFactsWithGemini(chunks.slice(index, index + 6));
      facts.entities.push(...extracted.entities.map((entity) => ({ ...entity, chunkIndex: entity.chunkIndex + index })));
      facts.relationships.push(...extracted.relationships.map((relationship) => ({ ...relationship, chunkIndex: relationship.chunkIndex + index })));
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Structured graph extraction failed.");
    facts = deterministicFacts(chunks);
    usedDeterministicFallback = true;
  }

  const resolved = new Map<string, StoredEntity>();
  resolved.set(normalizeEntityName(document.original_name), documentEntity);
  const discovered = new Set<string>();
  for (const entity of facts.entities) {
    const stored = await upsertEntity(supabase, organizationId, entity);
    resolved.set(normalizeEntityName(entity.canonicalName), stored);
    discovered.add(stored.canonical_name);
    const chunk = chunks[entity.chunkIndex];
    const { error } = await supabase.from("entity_mentions").upsert({
      organization_id: organizationId,
      entity_id: stored.id,
      document_id: document.id,
      chunk_id: chunk.id,
      surface_form: entity.canonicalName,
      context: chunk.content.slice(0, 1000),
      confidence: entity.confidence,
    }, { onConflict: "entity_id,chunk_id,surface_form" });
    if (error) throw error;
    if (stored.entity_type === "Asset") {
      facts.relationships.push({
        chunkIndex: entity.chunkIndex,
        source: document.original_name,
        target: stored.canonical_name,
        type: "MENTIONS",
        evidence: chunk.content.slice(0, 800),
        confidence: entity.confidence,
      });
    }
  }

  let relationshipCount = 0;
  for (const relation of facts.relationships) {
    const source = resolved.get(normalizeEntityName(relation.source));
    const target = resolved.get(normalizeEntityName(relation.target));
    const chunk = chunks[relation.chunkIndex];
    if (!source || !target || !chunk || source.id === target.id) continue;
    const { data: existing, error: existingError } = await supabase
      .from("entity_relationships")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("source_entity_id", source.id)
      .eq("target_entity_id", target.id)
      .eq("relationship_type", relation.type)
      .eq("evidence_chunk_id", chunk.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) continue;
    const { error } = await supabase.from("entity_relationships").insert({
      organization_id: organizationId,
      source_entity_id: source.id,
      target_entity_id: target.id,
      relationship_type: relation.type,
      evidence_document_id: document.id,
      evidence_chunk_id: chunk.id,
      evidence: relation.evidence,
      confidence: relation.confidence >= 0.8 ? "high" : relation.confidence >= 0.55 ? "medium" : "low",
      confidence_score: relation.confidence,
      metadata_json: { extraction: usedDeterministicFallback ? "deterministic-evidence" : "gemini-structured" },
    });
    if (error) throw error;
    relationshipCount += 1;
  }
  return { entities: [...discovered], relationshipCount, warnings };
}

export { normalizeEntityName };
