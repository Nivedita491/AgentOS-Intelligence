import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.58.0";
import { createEmbeddingProvider, toPgVector } from "../_shared/rag/embeddingService.ts";
import { buildGraphForDocument } from "../_shared/rag/graphService.ts";
import { bytesFromArrayBuffer, inferSourceType, parseUploadedDocument, semanticChunk } from "../_shared/rag/ingestion.ts";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../_shared/rag/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const BUCKET = "organizational-documents";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "pptx", "txt", "csv", "md", "markdown", "xlsx", "png", "jpg", "jpeg", "webp"]);

type Supabase = SupabaseClient;
type ProcessingStage = "uploaded" | "extracting" | "chunking" | "embedding" | "graph_building" | "ready" | "failed";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function publicMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Document processing failed.";
}

function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function classifyDocument(name: string): string {
  const lower = name.toLowerCase();
  if (/brand|guideline/.test(lower)) return "Brand Guideline";
  if (/pricing|price/.test(lower)) return "Pricing Strategy";
  if (/meeting|minutes|decision/.test(lower)) return "Meeting Notes";
  if (/policy/.test(lower)) return "Policy";
  if (/research|customer/.test(lower)) return "Customer Research";
  if (/manual|oem/.test(lower)) return "OEM Manual";
  if (/sop|standard/.test(lower)) return "Standard Operating Procedure";
  if (/inspection/.test(lower)) return "Inspection Report";
  if (/maintenance/.test(lower)) return "Maintenance Report";
  return "Organizational Document";
}

async function getDefaultOrganization(supabase: Supabase): Promise<{ id: string; slug: string }> {
  const { data, error } = await supabase.from("organizations").select("id, slug").eq("slug", "default").single();
  if (error) throw error;
  return data;
}

async function updateStage(supabase: Supabase, documentId: string, stage: ProcessingStage, patch: Record<string, unknown> = {}) {
  const label: Record<ProcessingStage, string> = {
    uploaded: "Uploaded",
    extracting: "Extracting",
    chunking: "Chunking",
    embedding: "Embedding",
    graph_building: "Graph Building",
    ready: "Ready",
    failed: "Failed",
  };
  const { error } = await supabase.from("documents").update({
    status: label[stage],
    processing_stage: stage,
    ...patch,
  }).eq("id", documentId);
  if (error) throw error;
}

async function clearDocumentIndex(supabase: Supabase, organizationId: string, documentId: string) {
  const { error: relationshipError } = await supabase
    .from("entity_relationships")
    .delete()
    .eq("organization_id", organizationId)
    .eq("evidence_document_id", documentId);
  if (relationshipError) throw relationshipError;
  const { error: mentionError } = await supabase
    .from("entity_mentions")
    .delete()
    .eq("organization_id", organizationId)
    .eq("document_id", documentId);
  if (mentionError) throw mentionError;
  const { error: chunkError } = await supabase.from("document_chunks").delete().eq("document_id", documentId);
  if (chunkError) throw chunkError;
}

async function resolveEmbeddings(
  supabase: Supabase,
  organizationId: string,
  chunks: Array<{ content: string; contentHash: string }>,
): Promise<Map<string, string>> {
  const hashes = [...new Set(chunks.map((chunk) => chunk.contentHash))];
  const cache = new Map<string, string>();
  if (hashes.length) {
    const { data, error } = await supabase
      .from("embedding_cache")
      .select("content_hash, embedding")
      .eq("organization_id", organizationId)
      .eq("model", EMBEDDING_MODEL)
      .in("content_hash", hashes);
    if (error) throw error;
    for (const row of data ?? []) cache.set(row.content_hash, typeof row.embedding === "string" ? row.embedding : `[${row.embedding.join(",")}]`);
  }
  const missing = chunks.filter((chunk) => !cache.has(chunk.contentHash));
  if (!missing.length) return cache;
  const vectors = await createEmbeddingProvider().embedBatch(missing.map((chunk) => chunk.content), "RETRIEVAL_DOCUMENT");
  const rows = missing.map((chunk, index) => ({
    organization_id: organizationId,
    content_hash: chunk.contentHash,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    embedding: toPgVector(vectors[index]),
  }));
  const { error } = await supabase.from("embedding_cache").upsert(rows, { onConflict: "organization_id,content_hash,model" });
  if (error) throw error;
  rows.forEach((row) => cache.set(row.content_hash, row.embedding));
  return cache;
}

async function processDocument(supabase: Supabase, organizationId: string, documentId: string) {
  let activeStage: ProcessingStage = "extracting";
  try {
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("organization_id", organizationId)
      .single();
    if (documentError) throw documentError;
    if (!document.storage_path) throw new Error("This document has no storage object. Upload it again before indexing.");

    await clearDocumentIndex(supabase, organizationId, documentId);
    await updateStage(supabase, documentId, "extracting", { processing_error: null });
    const { data: object, error: storageError } = await supabase.storage.from(BUCKET).download(document.storage_path);
    if (storageError) throw new Error(`Unable to read the uploaded file: ${storageError.message}`);
    const bytes = bytesFromArrayBuffer(await object.arrayBuffer());
    const parsed = await parseUploadedDocument(bytes, document.mime_type ?? "application/octet-stream", document.original_name);
    const sourceType = inferSourceType(document.original_name, document.mime_type ?? "application/octet-stream");
    await supabase.from("documents").update({
      parsed_text: parsed.text,
      page_count: parsed.pageCount,
      metadata_json: { ...(document.metadata_json ?? {}), ...parsed.metadata, extraction: { sourceType, completedAt: new Date().toISOString() } },
    }).eq("id", documentId);

    activeStage = "chunking";
    await updateStage(supabase, documentId, "chunking");
    const chunks = await semanticChunk(parsed, document.mime_type ?? "application/octet-stream", sourceType);
    if (!chunks.length) throw new Error("No usable content was extracted; nothing was indexed.");

    activeStage = "embedding";
    await updateStage(supabase, documentId, "embedding");
    const embeddings = await resolveEmbeddings(supabase, organizationId, chunks);
    const rows = chunks.map((chunk) => ({
      organization_id: organizationId,
      document_id: documentId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      content_hash: chunk.contentHash,
      page_number: chunk.pageNumber,
      section_name: chunk.sectionTitle,
      section_title: chunk.sectionTitle,
      heading_path: chunk.headingPath,
      source_type: chunk.sourceType,
      mime_type: chunk.mimeType,
      token_count: chunk.tokenCount,
      start_offset: chunk.startOffset,
      end_offset: chunk.endOffset,
      metadata_json: chunk.metadata,
      embedding: embeddings.get(chunk.contentHash),
    }));
    const { data: storedChunks, error: chunkError } = await supabase.from("document_chunks").insert(rows).select("id, chunk_index");
    if (chunkError) throw chunkError;
    if (!storedChunks?.length) throw new Error("Chunk indexing did not return stored chunk identifiers.");
    const chunkIds = new Map(storedChunks.map((chunk: { id: string; chunk_index: number }) => [chunk.chunk_index, chunk.id]));

    activeStage = "graph_building";
    await updateStage(supabase, documentId, "graph_building");
    const graph = await buildGraphForDocument(
      supabase,
      organizationId,
      { id: documentId, original_name: document.original_name },
      chunks.map((chunk) => ({ ...chunk, id: chunkIds.get(chunk.chunkIndex)! })),
    );
    await updateStage(supabase, documentId, "ready", {
      metadata_json: {
        ...(document.metadata_json ?? {}),
        ...parsed.metadata,
        entities: graph.entities,
        indexing: {
          embeddingModel: EMBEDDING_MODEL,
          embeddingDimensions: EMBEDDING_DIMENSIONS,
          chunkCount: chunks.length,
          entityCount: graph.entities.length,
          relationshipCount: graph.relationshipCount,
          graphWarnings: graph.warnings,
          completedAt: new Date().toISOString(),
        },
      },
    });
    return { documentId, status: "Ready", chunkCount: chunks.length, graph };
  } catch (error) {
    await updateStage(supabase, documentId, "failed", {
      error_message: publicMessage(error),
      processing_error: { stage: activeStage, message: publicMessage(error), occurredAt: new Date().toISOString() },
    });
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  try {
    const body = await request.json();
    const organization = await getDefaultOrganization(supabase);
    if (body.action === "create") {
      const originalName = typeof body.originalName === "string" ? body.originalName : "";
      const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
      const size = Number(body.fileSize);
      const extension = fileExtension(originalName);
      if (!originalName || !storagePath || !ALLOWED_EXTENSIONS.has(extension)) return json({ success: false, error: "Unsupported file type." }, 400);
      if (!storagePath.startsWith(`${organization.slug}/documents/`)) return json({ success: false, error: "Invalid document storage path." }, 400);
      if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return json({ success: false, error: "File must be between 1 byte and 15 MB." }, 400);
      const { data, error } = await supabase.from("documents").insert({
        organization_id: organization.id,
        filename: storagePath.split("/").at(-1),
        original_name: originalName.replace(/[\\/\0]/g, "_").slice(0, 255),
        storage_path: storagePath,
        mime_type: body.mimeType ?? "application/octet-stream",
        file_size: size,
        document_type: body.documentType ?? classifyDocument(originalName),
        classification: body.documentType ?? classifyDocument(originalName),
        linked_asset_id: body.linkedAssetId ?? null,
        source_department: body.department ?? null,
        metadata_json: { ...(body.metadata ?? {}), uploadedBy: "browser", originalSize: size },
        status: "Uploaded",
        processing_stage: "uploaded",
      }).select().single();
      if (error) throw error;
      return json({ success: true, document: data });
    }
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    if (!documentId) return json({ success: false, error: "documentId is required." }, 400);
    if (body.action === "process" || body.action === "reindex") {
      const result = await processDocument(supabase, organization.id, documentId);
      return json({ success: true, ...result });
    }
    if (body.action === "delete") {
      const { data: document, error: findError } = await supabase.from("documents").select("storage_path").eq("id", documentId).eq("organization_id", organization.id).single();
      if (findError) throw findError;
      await clearDocumentIndex(supabase, organization.id, documentId);
      const { error: deleteError } = await supabase.from("documents").delete().eq("id", documentId).eq("organization_id", organization.id);
      if (deleteError) throw deleteError;
      if (document.storage_path) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove([document.storage_path]);
        if (storageError) throw new Error(`Document row was deleted but storage cleanup failed: ${storageError.message}`);
      }
      await supabase.rpc("prune_orphan_graph_records", { p_organization_id: organization.id });
      return json({ success: true, documentId });
    }
    return json({ success: false, error: "Unknown ingestion action." }, 400);
  } catch (error) {
    console.error("rag-ingest", error);
    return json({ success: false, error: publicMessage(error) }, 500);
  }
});
