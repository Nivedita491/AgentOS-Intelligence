import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.58.0";
import { createEmbeddingProvider, toPgVector } from "../_shared/rag/embeddingService.ts";
import { buildGraphForDocument } from "../_shared/rag/graphService.ts";
import { bytesFromArrayBuffer, inferSourceType, parseUploadedDocument, semanticChunk } from "../_shared/rag/ingestion.ts";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../_shared/rag/types.ts";
import { recordActivity } from "../_shared/activity.ts";
import { validateRequest, generateRequestId, badRequest, internalError, unsupportedFormat, documentTooLarge, logFailure, logSuccess } from "../_shared/validation/index.ts";
import {
  RagIngestCreateSchema,
  RagIngestActionSchema,
  RagIngestAttachmentCreateSchema,
  RagIngestAttachmentDeleteSchema,
  RagIngestSupportingEvidenceFileSchema,
  RagIngestSupportingEvidenceLinkSchema,
  RagIngestSupportingEvidenceRemoveSchema,
} from "../_shared/validation/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Request-Id",
};
const BUCKET = "organizational-documents";
const MAX_BYTES = 15 * 1024 * 1024;
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
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

function attachmentPathIsSafe(storagePath: string, organizationSlug: string, documentId: string): boolean {
  const prefix = `${organizationSlug}/documents/${documentId}/attachments/`;
  return storagePath.startsWith(prefix) && !storagePath.includes("..") && storagePath.length > prefix.length;
}

function supportingEvidencePathIsSafe(storagePath: string, organizationSlug: string, documentId: string): boolean {
  const prefix = `${organizationSlug}/documents/${documentId}/evidence/`;
  return storagePath.startsWith(prefix) && !storagePath.includes("..") && storagePath.length > prefix.length;
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

async function processDocument(
  supabase: Supabase,
  organizationId: string,
  documentId: string,
  requestId: string,
  action: "process" | "reindex",
) {
  let activeStage: ProcessingStage = "extracting";
  const startedAt = Date.now();
  try {
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("organization_id", organizationId)
      .single();
    if (documentError) throw documentError;
    if (!document.storage_path) throw new Error("This document has no storage object. Upload it again before indexing.");

    await recordActivity(supabase, {
      organizationId, requestId, documentId, activityType: "DOCUMENT_PROCESSING_STARTED", category: "documents", status: "running",
      title: action === "reindex" ? "Document reindex started" : "Document indexing started",
      description: document.original_name,
      metadata: { documentName: document.original_name, mimeType: document.mime_type ?? null, action },
    });
    await clearDocumentIndex(supabase, organizationId, documentId);
    const { error: pruneError } = await supabase.rpc("prune_orphan_graph_records", { p_organization_id: organizationId });
    if (pruneError) throw pruneError;
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
    await recordActivity(supabase, {
      organizationId, requestId, documentId, activityType: "EMBEDDING_GENERATION_COMPLETED", category: "documents", status: "success",
      title: "Embeddings generated", description: document.original_name,
      metadata: { documentName: document.original_name, chunkCount: chunks.length, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS },
    });
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
    const graphStartedAt = Date.now();
    const graph = await buildGraphForDocument(
      supabase,
      organizationId,
      { id: documentId, original_name: document.original_name },
      chunks.map((chunk) => ({ ...chunk, id: chunkIds.get(chunk.chunkIndex)! })),
    );
    await recordActivity(supabase, {
      organizationId, requestId, documentId, activityType: "GRAPH_EXTRACTION_COMPLETED", category: "graph",
      status: graph.warnings.length ? "warning" : "success", title: "Knowledge graph extraction completed", description: document.original_name,
      durationMs: Date.now() - graphStartedAt,
      metadata: { documentName: document.original_name, entityCount: graph.entities.length, relationshipCount: graph.relationshipCount, warningCount: graph.warnings.length },
    });
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
    await recordActivity(supabase, {
      organizationId, requestId, documentId, activityType: action === "reindex" ? "DOCUMENT_REINDEXED" : "DOCUMENT_INDEXED", category: "documents", status: "success",
      title: action === "reindex" ? "Document reindexed" : "Document indexed", description: document.original_name,
      durationMs: Date.now() - startedAt,
      metadata: { documentName: document.original_name, mimeType: document.mime_type ?? null, chunkCount: chunks.length, entityCount: graph.entities.length, relationshipCount: graph.relationshipCount },
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
  if (request.method !== "POST") return json(badRequest("Method not allowed"), 405);
  const startedAt = Date.now();
  const requestId = generateRequestId();
  const endpoint = "rag-ingest";
  const context = { requestId, endpoint };
  let activitySupabase: Supabase | null = null;
  let activityOrganizationId: string | null = null;
  let activityDocumentId: string | null = null;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(internalError("Server configuration is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", requestId), 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    activitySupabase = supabase;
    const rawBody = await request.json();
    const action = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>).action : undefined;

    // Validate the create request with the dedicated schema.
    if (action === "create") {
      const parsed = validateRequest(rawBody, RagIngestCreateSchema, requestId);
      if (!parsed.ok) {
        logFailure(context, { operation: "create", code: "VALIDATION_ERROR", validationErrors: parsed.error.details, latencyMs: Date.now() - startedAt });
        const extension = fileExtension((rawBody as Record<string, unknown>).originalName as string);
        const size = Number((rawBody as Record<string, unknown>).fileSize);
        if (extension && !ALLOWED_EXTENSIONS.has(extension)) return json(unsupportedFormat("Unsupported file type.", requestId), 415);
        if (Number.isFinite(size) && size > MAX_BYTES) return json(documentTooLarge(`File exceeds ${Math.round(MAX_BYTES / (1024 * 1024))} MB limit.`, requestId), 413);
        return json(parsed.error, 400);
      }
      const body = parsed.data;
      const organization = await getDefaultOrganization(supabase);
      activityOrganizationId = organization.id;
      if (!body.storagePath.startsWith(`${organization.slug}/documents/`)) {
        logFailure(context, { operation: "create", code: "VALIDATION_ERROR", message: "Invalid document storage path.", latencyMs: Date.now() - startedAt });
        return json(badRequest("Invalid document storage path.", undefined, requestId), 400);
      }
      const { data, error } = await supabase.from("documents").insert({
        organization_id: organization.id,
        filename: body.storagePath.split("/").at(-1),
        original_name: body.originalName.replace(/[\\/\0]/g, "_").slice(0, 255),
        storage_path: body.storagePath,
        mime_type: body.mimeType ?? "application/octet-stream",
        file_size: body.fileSize,
        document_type: body.documentType ?? classifyDocument(body.originalName),
        classification: body.documentType ?? classifyDocument(body.originalName),
        linked_asset_id: body.linkedAssetId ?? null,
        source_department: body.department ?? null,
        metadata_json: { ...(body.metadata ?? {}), uploadedBy: "browser", originalSize: body.fileSize },
        status: "Uploaded",
        processing_stage: "uploaded",
      }).select().single();
      if (error) throw error;
      activityDocumentId = data.id;
      await recordActivity(supabase, {
        organizationId: organization.id, requestId, documentId: data.id, activityType: "DOCUMENT_UPLOADED", category: "documents", status: "success",
        title: "Document uploaded", description: data.original_name,
        durationMs: Date.now() - startedAt,
        metadata: { documentName: data.original_name, mimeType: data.mime_type, fileSize: data.file_size, documentType: data.document_type },
      });
      logSuccess(context, Date.now() - startedAt, { operation: "create", documentId: data.id });
      return json({ success: true, requestId, document: data });
    }

    if (action === "attachment-create") {
      const parsedAttachment = validateRequest(rawBody, RagIngestAttachmentCreateSchema, requestId);
      if (!parsedAttachment.ok) return json(parsedAttachment.error, 400);
      const body = parsedAttachment.data;
      const organization = await getDefaultOrganization(supabase);
      activityOrganizationId = organization.id;
      activityDocumentId = body.documentId;
      if (!attachmentPathIsSafe(body.storagePath, organization.slug, body.documentId)) {
        return json(badRequest("Invalid attachment storage path.", undefined, requestId), 400);
      }
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("id, original_name")
        .eq("id", body.documentId)
        .eq("organization_id", organization.id)
        .single();
      if (documentError) throw documentError;
      const { data: object, error: storageError } = await supabase.storage.from(BUCKET).download(body.storagePath);
      if (storageError || !object) throw new Error("Uploaded attachment was not found in private storage.");
      if (object.size !== body.fileSize || object.size > ATTACHMENT_MAX_BYTES) throw new Error("Attachment size validation failed.");
      const { data: attachment, error: attachmentError } = await supabase.from("record_attachments").insert({
        document_id: body.documentId,
        organization_id: organization.id,
        file_name: body.fileName,
        storage_path: body.storagePath,
        mime_type: body.mimeType,
        file_size: body.fileSize,
      }).select().single();
      if (attachmentError) throw attachmentError;
      await recordActivity(supabase, {
        organizationId: organization.id, requestId, documentId: body.documentId, activityType: "DOCUMENT_ATTACHMENT_UPLOADED", category: "documents", status: "success",
        title: "Document attachment uploaded", description: body.fileName,
        durationMs: Date.now() - startedAt,
        metadata: { documentName: document.original_name, attachmentId: attachment.id, fileName: body.fileName, fileSize: body.fileSize, mimeType: body.mimeType },
      });
      logSuccess(context, Date.now() - startedAt, { operation: "attachment-create", documentId: body.documentId, attachmentId: attachment.id });
      return json({ success: true, requestId, attachment });
    }

    if (action === "attachment-delete") {
      const parsedAttachment = validateRequest(rawBody, RagIngestAttachmentDeleteSchema, requestId);
      if (!parsedAttachment.ok) return json(parsedAttachment.error, 400);
      const body = parsedAttachment.data;
      const organization = await getDefaultOrganization(supabase);
      activityOrganizationId = organization.id;
      activityDocumentId = body.documentId;
      const { data: attachment, error: attachmentError } = await supabase
        .from("record_attachments")
        .select("id, file_name, file_size, storage_path")
        .eq("id", body.attachmentId)
        .eq("document_id", body.documentId)
        .eq("organization_id", organization.id)
        .single();
      if (attachmentError) throw attachmentError;
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
      if (storageError) throw new Error(`Attachment storage cleanup failed: ${storageError.message}`);
      await recordActivity(supabase, {
        organizationId: organization.id, requestId, documentId: body.documentId, activityType: "DOCUMENT_ATTACHMENT_DELETED", category: "documents", status: "success",
        title: "Document attachment deleted", description: attachment.file_name,
        durationMs: Date.now() - startedAt,
        metadata: { attachmentId: attachment.id, fileName: attachment.file_name, fileSize: attachment.file_size },
      });
      const { error: deleteError } = await supabase.from("record_attachments").delete().eq("id", attachment.id).eq("organization_id", organization.id);
      if (deleteError) throw deleteError;
      logSuccess(context, Date.now() - startedAt, { operation: "attachment-delete", documentId: body.documentId, attachmentId: attachment.id });
      return json({ success: true, requestId, documentId: body.documentId, attachmentId: attachment.id });
    }

    if (action === "supporting-evidence-file") {
      const parsedEvidence = validateRequest(rawBody, RagIngestSupportingEvidenceFileSchema, requestId);
      if (!parsedEvidence.ok) return json(parsedEvidence.error, 400);
      const body = parsedEvidence.data;
      const organization = await getDefaultOrganization(supabase);
      activityOrganizationId = organization.id;
      activityDocumentId = body.documentId;
      if (!supportingEvidencePathIsSafe(body.storagePath, organization.slug, body.documentId)) {
        return json(badRequest("Invalid supporting evidence storage path.", undefined, requestId), 400);
      }
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("id, original_name, supporting_storage_path")
        .eq("id", body.documentId)
        .eq("organization_id", organization.id)
        .single();
      if (documentError) throw documentError;
      const { data: object, error: storageError } = await supabase.storage.from(BUCKET).download(body.storagePath);
      if (storageError || !object) throw new Error("Uploaded supporting evidence was not found in private storage.");
      if (object.size !== body.fileSize || object.size > ATTACHMENT_MAX_BYTES) throw new Error("Supporting evidence size validation failed.");
      const { error: updateError } = await supabase.from("documents").update({
        supporting_evidence_type: "file",
        supporting_file_name: body.fileName,
        supporting_storage_path: body.storagePath,
        supporting_mime_type: body.mimeType,
        supporting_file_size: body.fileSize,
        supporting_url: null,
        supporting_uploaded_at: new Date().toISOString(),
      }).eq("id", body.documentId).eq("organization_id", organization.id);
      if (updateError) throw updateError;
      if (document.supporting_storage_path && document.supporting_storage_path !== body.storagePath) {
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([document.supporting_storage_path]);
        if (cleanupError) console.warn("Supporting evidence replacement cleanup failed", cleanupError.message);
      }
      await recordActivity(supabase, {
        organizationId: organization.id, requestId, documentId: body.documentId, activityType: "RECORD_EVIDENCE_ATTACHED", category: "documents", status: "success",
        title: "Supporting evidence attached", description: body.fileName,
        durationMs: Date.now() - startedAt,
        metadata: { documentName: document.original_name, evidenceType: "file", fileName: body.fileName, fileSize: body.fileSize, mimeType: body.mimeType },
      });
      logSuccess(context, Date.now() - startedAt, { operation: "supporting-evidence-file", documentId: body.documentId });
      return json({ success: true, requestId, documentId: body.documentId });
    }

    if (action === "supporting-evidence-link") {
      const parsedEvidence = validateRequest(rawBody, RagIngestSupportingEvidenceLinkSchema, requestId);
      if (!parsedEvidence.ok) return json(parsedEvidence.error, 400);
      const body = parsedEvidence.data;
      const organization = await getDefaultOrganization(supabase);
      activityOrganizationId = organization.id;
      activityDocumentId = body.documentId;
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("id, original_name, supporting_storage_path")
        .eq("id", body.documentId)
        .eq("organization_id", organization.id)
        .single();
      if (documentError) throw documentError;
      const { error: updateError } = await supabase.from("documents").update({
        supporting_evidence_type: "link",
        supporting_file_name: null,
        supporting_storage_path: null,
        supporting_mime_type: null,
        supporting_file_size: null,
        supporting_url: body.url,
        supporting_uploaded_at: new Date().toISOString(),
      }).eq("id", body.documentId).eq("organization_id", organization.id);
      if (updateError) throw updateError;
      if (document.supporting_storage_path) {
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([document.supporting_storage_path]);
        if (cleanupError) console.warn("Supporting evidence replacement cleanup failed", cleanupError.message);
      }
      await recordActivity(supabase, {
        organizationId: organization.id, requestId, documentId: body.documentId, activityType: "RECORD_EVIDENCE_ATTACHED", category: "documents", status: "success",
        title: "Supporting evidence linked", description: body.url,
        durationMs: Date.now() - startedAt,
        metadata: { documentName: document.original_name, evidenceType: "link", supportingUrl: body.url },
      });
      logSuccess(context, Date.now() - startedAt, { operation: "supporting-evidence-link", documentId: body.documentId });
      return json({ success: true, requestId, documentId: body.documentId });
    }

    if (action === "supporting-evidence-remove") {
      const parsedEvidence = validateRequest(rawBody, RagIngestSupportingEvidenceRemoveSchema, requestId);
      if (!parsedEvidence.ok) return json(parsedEvidence.error, 400);
      const body = parsedEvidence.data;
      const organization = await getDefaultOrganization(supabase);
      activityOrganizationId = organization.id;
      activityDocumentId = body.documentId;
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .select("id, original_name, supporting_evidence_type, supporting_file_name, supporting_file_size, supporting_storage_path")
        .eq("id", body.documentId)
        .eq("organization_id", organization.id)
        .single();
      if (documentError) throw documentError;
      if (!document.supporting_evidence_type) return json({ success: true, requestId, documentId: body.documentId });
      if (document.supporting_storage_path) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove([document.supporting_storage_path]);
        if (storageError) throw new Error(`Supporting evidence storage cleanup failed: ${storageError.message}`);
      }
      const { error: updateError } = await supabase.from("documents").update({
        supporting_evidence_type: null,
        supporting_file_name: null,
        supporting_storage_path: null,
        supporting_mime_type: null,
        supporting_file_size: null,
        supporting_url: null,
        supporting_uploaded_at: null,
      }).eq("id", body.documentId).eq("organization_id", organization.id);
      if (updateError) throw updateError;
      await recordActivity(supabase, {
        organizationId: organization.id, requestId, documentId: body.documentId, activityType: "RECORD_EVIDENCE_REMOVED", category: "documents", status: "success",
        title: "Supporting evidence removed", description: document.supporting_file_name ?? document.original_name,
        durationMs: Date.now() - startedAt,
        metadata: { documentName: document.original_name, evidenceType: document.supporting_evidence_type, fileName: document.supporting_file_name, fileSize: document.supporting_file_size },
      });
      logSuccess(context, Date.now() - startedAt, { operation: "supporting-evidence-remove", documentId: body.documentId });
      return json({ success: true, requestId, documentId: body.documentId });
    }

    // Validate process / reindex / delete against the action schema.
    const parsedAction = validateRequest(rawBody, RagIngestActionSchema, requestId);
    if (!parsedAction.ok) {
      logFailure(context, { operation: action ?? "unknown", code: "VALIDATION_ERROR", validationErrors: parsedAction.error.details, latencyMs: Date.now() - startedAt });
      return json(parsedAction.error, 400);
    }
    const actionBody = parsedAction.data;
    const organization = await getDefaultOrganization(supabase);
    activityOrganizationId = organization.id;
    const documentId = actionBody.documentId;
    activityDocumentId = documentId;
    if (actionBody.action === "process" || actionBody.action === "reindex") {
      const result = await processDocument(supabase, organization.id, documentId, requestId, actionBody.action);
      logSuccess(context, Date.now() - startedAt, { operation: actionBody.action, documentId });
      return json({ success: true, requestId, ...result });
    }
    if (actionBody.action === "delete") {
      const { data: document, error: findError } = await supabase.from("documents").select("storage_path, original_name, mime_type, supporting_storage_path").eq("id", documentId).eq("organization_id", organization.id).single();
      if (findError) throw findError;
      const { data: attachments, error: attachmentsError } = await supabase
        .from("record_attachments")
        .select("storage_path")
        .eq("document_id", documentId)
        .eq("organization_id", organization.id);
      if (attachmentsError) throw attachmentsError;
      await clearDocumentIndex(supabase, organization.id, documentId);
      const storagePaths = [document.storage_path, document.supporting_storage_path, ...(attachments ?? []).map((attachment: { storage_path: string }) => attachment.storage_path)].filter((path): path is string => Boolean(path));
      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove(storagePaths);
        if (storageError) throw new Error(`Storage cleanup failed: ${storageError.message}`);
      }
      await recordActivity(supabase, {
        organizationId: organization.id, requestId, documentId, activityType: "DOCUMENT_DELETED", category: "documents", status: "success",
        title: "Document deleted", description: document.original_name,
        durationMs: Date.now() - startedAt,
        metadata: { documentName: document.original_name, mimeType: document.mime_type ?? null, storageCleanup: storagePaths.length, attachmentCount: attachments?.length ?? 0, supportingEvidenceCleanup: Boolean(document.supporting_storage_path) },
      });
      const { error: deleteError } = await supabase.from("documents").delete().eq("id", documentId).eq("organization_id", organization.id);
      if (deleteError) throw deleteError;
      await supabase.rpc("prune_orphan_graph_records", { p_organization_id: organization.id });
      logSuccess(context, Date.now() - startedAt, { operation: "delete", documentId });
      return json({ success: true, requestId, documentId });
    }
    return json(badRequest("Unknown ingestion action.", undefined, requestId), 400);
  } catch (error) {
    console.error("rag-ingest", error);
    if (activitySupabase && activityOrganizationId) {
      await recordActivity(activitySupabase, {
        organizationId: activityOrganizationId, requestId, documentId: activityDocumentId, activityType: "ERROR_OCCURRED", category: "system", status: "failed",
        title: "Document ingestion failed", description: "The document action did not complete. See the request ID for the correlated server error.",
        durationMs: Date.now() - startedAt, metadata: { endpoint, documentId: activityDocumentId }, errorCode: "INGESTION_FAILED",
      });
    }
    logFailure(context, { operation: "unknown", code: "INTERNAL_ERROR", latencyMs: Date.now() - startedAt });
    return json(internalError(publicMessage(error), requestId), 500);
  }
});
