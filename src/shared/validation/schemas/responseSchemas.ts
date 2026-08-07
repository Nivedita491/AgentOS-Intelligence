/**
 * Zod response schemas for the standard API envelope.
 *
 * Validating responses against these schemas ensures the frontend never silently
 * trusts a malformed payload.
 */

import { z } from 'zod';

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  requestId: z.string(),
  code: z.string(),
  message: z.string(),
  details: z
    .union([
      z.record(z.string(), z.unknown()),
      z.array(z.object({ path: z.string(), message: z.string() })),
    ])
    .optional(),
  timestamp: z.string(),
});

export const ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    requestId: z.string(),
    data: dataSchema,
    meta: z.record(z.string(), z.unknown()).optional(),
  });

/** Generic success envelope with unknown data (used where data is unstructured). */
export const GenericSuccessSchema = ApiSuccessResponseSchema(z.unknown());

/** Search-mode hybrid retrieval debug response (mode: 'search'). */
export const RetrievalSearchResponseSchema = z.object({
  success: z.literal(true),
  retrieval: z.record(z.string(), z.unknown()),
});

/** Document create response. */
export const DocumentCreateResponseSchema = z.object({
  success: z.literal(true),
  document: z.record(z.string(), z.unknown()),
});

/** Document action response (process / reindex / delete). */
export const DocumentActionResponseSchema = z.object({
  success: z.literal(true),
  documentId: z.string(),
  status: z.string().optional(),
  chunkCount: z.number().optional(),
  graph: z.unknown().optional(),
});

export const ForgeAIResponseSchema = z.object({
  success: z.literal(true),
  requestId: z.string(),
  answer: z.record(z.string(), z.unknown()).optional(),
  retrieval: z.record(z.string(), z.unknown()).optional(),
}).refine((payload) => Boolean(payload.answer) || Boolean(payload.retrieval), {
  message: 'Response must include either answer or retrieval payload.',
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ForgeAIResponse = z.infer<typeof ForgeAIResponseSchema>;
