/**
 * Zod request schemas for every AgentOS Intelligence API surface.
 *
 * Each schema infers a TypeScript type (e.g. `QueryRequest = z.infer<typeof QuerySchema>`)
 * so typed request models flow through the whole application.
 */

import { z } from 'zod';
import { boundedInt, isoDateSchema, metadataSchema, shortString, stringArray, uuidSchema } from './common';

export const activityTypes = [
  'DOCUMENT_UPLOADED', 'DOCUMENT_PROCESSING_STARTED', 'EMBEDDING_GENERATION_COMPLETED', 'DOCUMENT_INDEXED', 'DOCUMENT_REINDEXED', 'DOCUMENT_DELETED', 'DOCUMENT_ATTACHMENT_UPLOADED', 'DOCUMENT_ATTACHMENT_DELETED', 'RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_EVIDENCE_ATTACHED', 'RECORD_EVIDENCE_REMOVED', 'RECORD_SEARCH_EXECUTED', 'RECORD_REPORT_EXPORTED', 'LOCAL_KNOWLEDGE_QUERY_COMPLETED',
  'RAG_QUERY_STARTED', 'RAG_QUERY_COMPLETED', 'RAG_QUERY_FAILED', 'RETRIEVAL_COMPLETED', 'COPILOT_RESPONSE_GENERATED', 'GRAPH_EXTRACTION_COMPLETED',
  'MEMORY_WRITTEN', 'SETTINGS_UPDATED', 'ERROR_OCCURRED', 'AGENT_STARTED', 'AGENT_COMPLETED', 'AGENT_FAILED', 'JOB_STARTED', 'JOB_COMPLETED', 'JOB_FAILED',
] as const;
export const activityCategories = ['documents', 'rag', 'ai', 'graph', 'memory', 'system', 'agents'] as const;
export const activityStatuses = ['success', 'failed', 'running', 'warning'] as const;

// ---------- RAG Query ----------
export const QuerySchema = z.object({
  query: z.string().min(3).max(8000),
  organizationId: uuidSchema.optional(),
  topK: boundedInt(1, 50).default(6),
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
export type QueryRequest = z.infer<typeof QuerySchema>;

// ---------- Hybrid Retrieval Request ----------
export const HybridRetrievalSchema = z.object({
  query: z.string().min(3).max(8000),
  organizationId: uuidSchema.optional(),
  mode: z.enum(['search', 'generate']).default('generate'),
  assetId: z.string().uuid().optional().nullable(),
  topK: boundedInt(1, 50).optional(),
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
export type HybridRetrievalRequest = z.infer<typeof HybridRetrievalSchema>;

// ---------- Document Upload ----------
export const DocumentUploadSchema = z.object({
  action: z.literal('create'),
  storagePath: z.string().min(1).max(1024),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().max(200).optional(),
  fileSize: z.number().int().min(1).max(15 * 1024 * 1024),
  linkedAssetId: z.string().uuid().nullable().optional(),
  documentType: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type DocumentUploadRequest = z.infer<typeof DocumentUploadSchema>;

// ---------- Document Action (process / reindex / delete) ----------
export const DocumentActionSchema = z.object({
  action: z.enum(['process', 'reindex', 'delete']),
  documentId: uuidSchema,
});
export type DocumentActionRequest = z.infer<typeof DocumentActionSchema>;

export const DocumentUpdateSchema = z.object({
  documentId: uuidSchema,
  documentType: z.string().min(1).max(120),
  classification: z.string().max(120).nullable(),
  sourceDepartment: z.string().max(120).nullable(),
  status: z.enum(['Uploaded', 'Extracting', 'Parsing', 'Chunking', 'Embedding', 'Graph Building', 'Indexed', 'Ready', 'Failed']),
  notes: z.string().max(4000).optional(),
  recommendations: z.array(z.string().min(1).max(1000)).max(20).optional(),
});
export type DocumentUpdateRequest = z.infer<typeof DocumentUpdateSchema>;

// ---------- Document Attachments ----------
export const documentAttachmentExtensions = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'csv'] as const;
export const documentAttachmentMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv',
] as const;

export const DocumentAttachmentUploadSchema = z.object({
  documentId: uuidSchema,
  fileName: z.string().min(1).max(255).refine((name) => !/[\\/\0]/.test(name), 'Filename contains unsupported characters.'),
  extension: z.enum(documentAttachmentExtensions),
  mimeType: z.enum(documentAttachmentMimeTypes),
  fileSize: boundedInt(1, 10 * 1024 * 1024),
  storagePath: z.string().min(1).max(1024),
});
export type DocumentAttachmentUploadRequest = z.infer<typeof DocumentAttachmentUploadSchema>;

export const DocumentAttachmentDeleteSchema = z.object({
  documentId: uuidSchema,
  attachmentId: uuidSchema,
});
export type DocumentAttachmentDeleteRequest = z.infer<typeof DocumentAttachmentDeleteSchema>;

export const DocumentAttachmentListSchema = z.object({ documentId: uuidSchema });
export const DocumentAttachmentIdSchema = z.object({ attachmentId: uuidSchema });

export const DocumentAttachmentSchema = z.object({
  id: uuidSchema,
  documentId: uuidSchema,
  organizationId: uuidSchema,
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(1).max(1024),
  mimeType: z.enum(documentAttachmentMimeTypes).nullable(),
  fileSize: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type DocumentAttachmentResponse = z.infer<typeof DocumentAttachmentSchema>;

// ---------- One supporting evidence item per document ----------
export const supportingEvidenceExtensions = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'] as const;
export const supportingEvidenceMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/webp',
] as const;
const supportingEvidenceMimeByExtension: Record<(typeof supportingEvidenceExtensions)[number], (typeof supportingEvidenceMimeTypes)[number]> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const SupportingEvidenceUploadSchema = z.object({
  documentId: uuidSchema,
  fileName: z.string().min(1).max(255).refine((name) => !/[\\/\0]/.test(name), 'Filename contains unsupported characters.'),
  extension: z.enum(supportingEvidenceExtensions),
  mimeType: z.enum(supportingEvidenceMimeTypes),
  fileSize: boundedInt(1, 10 * 1024 * 1024),
  storagePath: z.string().min(1).max(1024),
}).refine((value) => supportingEvidenceMimeByExtension[value.extension] === value.mimeType, {
  path: ['mimeType'],
  message: 'File extension and MIME type do not match.',
});
export type SupportingEvidenceUploadRequest = z.infer<typeof SupportingEvidenceUploadSchema>;

export const EvidenceURLSchema = z.object({
  documentId: uuidSchema,
  url: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value), 'Only HTTP(S) evidence links are supported.'),
});
export type EvidenceURLRequest = z.infer<typeof EvidenceURLSchema>;

export const SupportingEvidenceRemoveSchema = z.object({ documentId: uuidSchema });

export const RecordFiltersSchema = z.object({
  keyword: z.string().max(200).trim().optional(),
  documentType: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  status: z.enum(['Uploaded', 'Extracting', 'Parsing', 'Chunking', 'Embedding', 'Graph Building', 'Indexed', 'Ready', 'Failed']).optional(),
});
export type RecordFiltersRequest = z.infer<typeof RecordFiltersSchema>;

export const ReportExportRequestSchema = z.object({
  documentId: uuidSchema,
  format: z.enum(['csv', 'html', 'pdf']),
});
export type ReportExportRequest = z.infer<typeof ReportExportRequestSchema>;

// ---------- Graph Search ----------
export const GraphSearchSchema = z.object({
  query: z.string().min(1).max(8000),
  organizationId: uuidSchema.optional(),
  entityTypes: stringArray(30),
  relationshipTypes: stringArray(30),
  maxHops: boundedInt(1, 5).default(2),
  limit: boundedInt(1, 100).default(20),
});
export type GraphSearchRequest = z.infer<typeof GraphSearchSchema>;

// ---------- Memory Search ----------
export const MemorySearchSchema = z.object({
  query: z.string().min(1).max(8000),
  organizationId: uuidSchema.optional(),
  memoryType: z.enum(['working', 'episodic', 'semantic', 'graph']).default('episodic'),
  limit: boundedInt(1, 100).default(30),
});
export type MemorySearchRequest = z.infer<typeof MemorySearchSchema>;

// ---------- Agent Execute ----------
export const AgentExecuteSchema = z.object({
  agentId: z.string().min(1).max(120),
  task: z.string().min(1).max(8000),
  organizationId: uuidSchema.optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  capabilities: stringArray(20),
  timeoutMs: boundedInt(1000, 120000).optional(),
});
export type AgentExecuteRequest = z.infer<typeof AgentExecuteSchema>;

// ---------- Job Creation ----------
export const JobCreationSchema = z.object({
  jobType: z.string().min(1).max(120),
  payload: z.record(z.string(), z.unknown()).optional(),
  organizationId: uuidSchema.optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  scheduledAt: isoDateSchema,
});
export type JobCreationRequest = z.infer<typeof JobCreationSchema>;

// ---------- History Query ----------
export const HistoryQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  limit: boundedInt(1, 200).default(20),
  offset: boundedInt(0, 10000).default(0),
  intent: z.string().max(120).optional(),
});
export type HistoryQueryRequest = z.infer<typeof HistoryQuerySchema>;

// ---------- Persistent Activity History ----------
export const CreateActivityEventSchema = z.object({
  organizationId: uuidSchema,
  userId: uuidSchema.nullable().optional(),
  requestId: z.string().min(1).max(160).nullable().optional(),
  activityType: z.enum(activityTypes),
  category: z.enum(activityCategories),
  status: z.enum(activityStatuses),
  title: shortString(240),
  description: z.string().max(2000).nullable().optional(),
  entityType: z.string().max(120).nullable().optional(),
  entityId: z.string().max(255).nullable().optional(),
  documentId: uuidSchema.nullable().optional(),
  taskId: z.string().max(160).nullable().optional(),
  agentName: z.string().max(160).nullable().optional(),
  durationMs: boundedInt(0, 24 * 60 * 60 * 1000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  errorCode: z.string().max(120).nullable().optional(),
});
export type CreateActivityEventRequest = z.infer<typeof CreateActivityEventSchema>;

export const ActivityEventSchema = CreateActivityEventSchema.extend({
  id: uuidSchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type ActivityEventResponse = z.infer<typeof ActivityEventSchema>;

export const ActivityHistoryQuerySchema = z.object({
  organizationId: uuidSchema.optional(),
  activityType: z.enum(activityTypes).optional(),
  category: z.enum(activityCategories).optional(),
  status: z.enum(activityStatuses).optional(),
  search: z.string().max(200).trim().optional(),
  dateFrom: isoDateSchema,
  dateTo: isoDateSchema,
  limit: boundedInt(1, 100).default(25),
  offset: boundedInt(0, 10000).default(0),
}).superRefine((value, context) => {
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dateTo'], message: 'dateTo must be on or after dateFrom.' });
  }
});
export type ActivityHistoryQueryRequest = z.infer<typeof ActivityHistoryQuerySchema>;

// ---------- User Actions ----------
export const UserActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'flag', 'acknowledge', 'resolve', 'create', 'update', 'delete']),
  entityType: z.string().min(1).max(120),
  entityId: uuidSchema,
  payload: z.record(z.string(), z.unknown()).optional(),
  note: z.string().max(2000).optional(),
});
export type UserActionRequest = z.infer<typeof UserActionSchema>;

// ---------- Copilot Query (forge-ai) ----------
export const CopilotQuerySchema = z.object({
  query: z.string().min(3).max(8000),
  assetId: z.string().uuid().optional().nullable(),
  mode: z.enum(['search', 'generate']).default('generate'),
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
export type CopilotQueryRequest = z.infer<typeof CopilotQuerySchema>;

// ---------- Settings Read ----------
export const SettingsQuerySchema = z.object({
  keys: stringArray(50),
});
export type SettingsQueryRequest = z.infer<typeof SettingsQuerySchema>;
