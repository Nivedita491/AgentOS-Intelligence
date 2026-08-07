/**
 * Typed validation helpers built on Zod.
 *
 * These helpers wrap request parsing and response parsing so every endpoint uses
 * the same validation pipeline without duplicating error mapping logic.
 */

import { z } from 'zod';
import type { ApiError } from './apiResponse';
import { validationError } from './apiResponse';

export interface ParseResult<T> {
  success: true;
  data: T;
}

export interface ParseFailure {
  success: false;
  error: ApiError;
}

export type ParseOutcome<T> = ParseResult<T> | ParseFailure;

/**
 * Parses an unknown request body against a Zod schema and returns a typed result
 * or a standardized VALIDATION_ERROR with field-level details.
 */
export function parseRequest<T extends z.ZodTypeAny>(
  input: unknown,
  schema: T,
  requestId?: string,
): ParseOutcome<z.infer<T>> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const details = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  return { success: false, error: validationError(details, undefined, requestId) };
}

/**
 * Validates an unknown response payload against a Zod schema. Returns the typed
 * value on success, or a standardized response-validation error.
 */
export function parseResponse<T extends z.ZodTypeAny>(
  input: unknown,
  schema: T,
  requestId?: string,
): ParseOutcome<z.infer<T>> {
  return parseRequest(input, schema, requestId);
}

/** Convenience: throws a typed ApiError when parsing fails. */
export function assertRequest<T extends z.ZodTypeAny>(input: unknown, schema: T, requestId?: string): z.infer<T> {
  const outcome = parseRequest(input, schema, requestId);
  if (!outcome.success) throw outcome.error;
  return outcome.data;
}
