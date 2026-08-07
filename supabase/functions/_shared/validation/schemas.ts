// Zod request/response schemas for the Edge Function validation layer.
// Deno-compatible; imports zod via npm:.

import { z } from "npm:zod@3.23.8";

export const uuidSchema = z.string().uuid();

export const shortString = (max = 200, min = 1) => z.string().min(min).max(max).trim();

export const stringArray = (maxItems = 50, itemMax = 200) =>
  z.array(z.string().min(1).max(itemMax).trim()).max(maxItems).optional();

export const metadataSchema = z.record(z.string(), z.unknown()).optional();

export const isoDateSchema = z.string().datetime({ offset: true }).optional();

export const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max);

// ---------- forge-ai (Copilot / RAG search) ----------
export const ForgeAIRequestSchema = z.object({
  query: z.string().min(3).max(8000),
  assetId: z.string().uuid().optional().nullable(),
  mode: z.enum(["search", "generate"]).default("generate"),
  filters: z
    .object({
      documentIds: stringArray(50),
      sourceTypes: stringArray(20),
      department: shortString(120).optional(),
      tags: stringArray(50),
      dateFrom: isoDateSchema,
      dateTo: isoDateSchema,
      metadata: metadataSchema,
      entityIds: stringArray(50),
    })
    .optional(),
});
export type ForgeAIRequest = z.infer<typeof ForgeAIRequestSchema>;

export const ForgeAISearchResponseSchema = z.object({
  success: z.literal(true),
  retrieval: z.record(z.string(), z.unknown()),
});

// ---------- rag-ingest ----------
export const RagIngestCreateSchema = z.object({
  action: z.literal("create"),
  storagePath: z.string().min(1).max(1024),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().max(200).optional(),
  fileSize: z.number().int().min(1).max(15 * 1024 * 1024),
  linkedAssetId: z.string().uuid().nullable().optional(),
  documentType: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type RagIngestCreateRequest = z.infer<typeof RagIngestCreateSchema>;

export const RagIngestActionSchema = z.object({
  action: z.enum(["process", "reindex", "delete"]),
  documentId: uuidSchema,
});
export type RagIngestActionRequest = z.infer<typeof RagIngestActionSchema>;

export const RagIngestDocumentSchema = z.record(z.string(), z.unknown());

export const RagIngestCreateResponseSchema = z.object({
  success: z.literal(true),
  document: RagIngestDocumentSchema,
});

export const RagIngestActionResponseSchema = z.object({
  success: z.literal(true),
  documentId: z.string(),
  status: z.string().optional(),
  chunkCount: z.number().optional(),
  graph: z.unknown().optional(),
});
