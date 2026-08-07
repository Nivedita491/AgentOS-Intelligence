/**
 * Standard API response envelope for the AgentOS Intelligence validation layer.
 *
 * Success:
 *   { success: true, requestId, data, meta }
 * Failure:
 *   { success: false, requestId, code, message, details, timestamp }
 *
 * Every endpoint returns exactly one of these shapes. The frontend consumes these
 * via the shared error utilities so users never see raw exceptions.
 */

import type { ApiErrorCodeValue } from './errorCodes';
import { ERROR_MESSAGES } from './errorCodes';
import { generateRequestId } from './requestId';

export interface ApiSuccess<T = unknown> {
  success: true;
  requestId: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  requestId: string;
  code: ApiErrorCodeValue;
  message: string;
  details?: Record<string, unknown> | Array<{ path: string; message: string }>;
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/** Build a typed success envelope. */
export function ok<T>(data: T, meta?: Record<string, unknown>, requestId = generateRequestId()): ApiSuccess<T> {
  return { success: true, requestId, data, meta };
}

/** Build a typed "created" success envelope. */
export function created<T>(data: T, meta?: Record<string, unknown>, requestId = generateRequestId()): ApiSuccess<T> {
  return { success: true, requestId, data, meta: { ...(meta ?? {}), status: 201 } };
}

/** Build a generic failure envelope from a code and message. */
export function apiError(
  code: ApiErrorCodeValue,
  message?: string,
  details?: Record<string, unknown> | Array<{ path: string; message: string }>,
  requestId = generateRequestId(),
): ApiError {
  return {
    success: false,
    requestId,
    code,
    message: message ?? ERROR_MESSAGES[code],
    details,
    timestamp: new Date().toISOString(),
  };
}

export function badRequest(message?: string, details?: ApiError['details'], requestId?: string): ApiError {
  return apiError('VALIDATION_ERROR', message, details, requestId);
}

export function validationError(details?: ApiError['details'], message?: string, requestId?: string): ApiError {
  return apiError('VALIDATION_ERROR', message, details, requestId);
}

export function notFound(message?: string, requestId?: string): ApiError {
  return apiError('NOT_FOUND', message, undefined, requestId);
}

export function internalError(message?: string, requestId?: string): ApiError {
  return apiError('INTERNAL_ERROR', message, undefined, requestId);
}

export function unauthorized(message?: string, requestId?: string): ApiError {
  return apiError('UNAUTHORIZED', message, undefined, requestId);
}

export function forbidden(message?: string, requestId?: string): ApiError {
  return apiError('FORBIDDEN', message, undefined, requestId);
}

export function conflict(message?: string, requestId?: string): ApiError {
  return apiError('CONFLICT', message, undefined, requestId);
}

export function rateLimited(message?: string, requestId?: string): ApiError {
  return apiError('RATE_LIMITED', message, undefined, requestId);
}

export function documentTooLarge(message?: string, requestId?: string): ApiError {
  return apiError('DOCUMENT_TOO_LARGE', message, undefined, requestId);
}

export function unsupportedFormat(message?: string, requestId?: string): ApiError {
  return apiError('UNSUPPORTED_FORMAT', message, undefined, requestId);
}

/** Narrow a parsed JSON body to a typed ApiError. */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ApiError).success === false &&
    typeof (value as ApiError).code === 'string'
  );
}
