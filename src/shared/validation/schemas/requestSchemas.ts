/**
 * Zod request schemas for every AgentOS Intelligence API surface.
 *
 * Each schema infers a TypeScript type (e.g. `QueryRequest = z.infer<typeof QuerySchema>`)
 * so typed request models flow through the whole application.
 */

import { z } from 'zod';
import { boundedInt, isoDateSchema, metadataSchema, shortString, stringArray, uuidSchema } from './common';

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
