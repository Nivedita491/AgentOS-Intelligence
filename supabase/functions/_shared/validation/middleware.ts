// Reusable validation middleware for the Edge Function validation layer.
// Provides validateRequest, validateResponse and handleErrors so validation
// logic is not repeated inside every endpoint.

import type { ZodType, ZodTypeAny } from "npm:zod@3.23.8";
import { z } from "npm:zod@3.23.8";
import { validationError } from "./apiResponse.ts";
import { HTTP_STATUS } from "./errorCodes.ts";
import type { ApiErrorCodeValue } from "./errorCodes.ts";
import { generateRequestId } from "./requestId.ts";

export interface ValidatedResult<T> {
  ok: true;
  data: T;
}

export interface ValidatedFailure {
  ok: false;
  error: ReturnType<typeof validationError>;
}

export type ValidatedOutcome<T> = ValidatedResult<T> | ValidatedFailure;

/**
 * Validates an unknown request body against a Zod schema and returns a typed
 * result or a standardized VALIDATION_ERROR with field-level details.
 */
export function validateRequest<T extends ZodTypeAny>(input: unknown, schema: T, requestId?: string): ValidatedOutcome<z.infer<T>> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data as z.infer<T> };
  }
  const details = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return { ok: false, error: validationError(details, undefined, requestId ?? generateRequestId()) };
}

/** Validates a response payload against a Zod schema. */
export function validateResponse<T extends ZodTypeAny>(input: unknown, schema: T, requestId?: string): ValidatedOutcome<z.infer<T>> {
  return validateRequest(input, schema, requestId);
}

export interface ErrorEnvelope {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Converts a thrown/known error into a standard error envelope.
 * Never exposes stack traces. Unknown/inner errors map to INTERNAL_ERROR.
 */
export function handleErrors(error: unknown, requestId = generateRequestId()): ErrorEnvelope {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const candidate = error as { code?: unknown; message?: unknown; details?: unknown; status?: unknown };
    if (typeof candidate.code === "string" && candidate.code in HTTP_STATUS) {
      return {
        status: typeof candidate.status === "number" ? candidate.status : HTTP_STATUS[candidate.code as ApiErrorCodeValue],
        body: {
          success: false,
          requestId,
          code: candidate.code,
          message: typeof candidate.message === "string" ? candidate.message.slice(0, 500) : "An error occurred.",
          details: candidate.details as Record<string, unknown> | undefined,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
  const safeMessage = error instanceof Error ? error.message.slice(0, 500) : "An unexpected error occurred.";
  return {
    status: HTTP_STATUS.INTERNAL_ERROR,
    body: {
      success: false,
      requestId,
      code: "INTERNAL_ERROR",
      message: safeMessage,
      timestamp: new Date().toISOString(),
    },
  };
}

/** A simple type guard imported here for convenience. */
export type { ZodType };
