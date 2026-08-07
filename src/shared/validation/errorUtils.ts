/**
 * Frontend error utilities for the Structured API Validation Layer.
 *
 * Every API call should resolve to one of:
 *   Loading / Success / ValidationError / Server / Network / Unknown
 * and surface a friendly, human-readable message. Raw exceptions are never shown.
 */

import type { ApiError } from './apiResponse';
import { isApiError } from './apiResponse';
import { ApiErrorCode, ERROR_MESSAGES } from './errorCodes';

export type UiErrorKind = 'validation' | 'server' | 'network' | 'unauthorized' | 'forbidden' | 'not-found' | 'rate-limited' | 'file-too-large' | 'unsupported-format' | 'unknown';

export interface FriendlyError {
  kind: UiErrorKind;
  title: string;
  message: string;
  requestId?: string;
  code?: string;
  /** Optional structured details for the expandable technical section. */
  details?: unknown;
  /** True when a retry is likely to help. */
  retryable: boolean;
}

const KIND_TITLES: Record<UiErrorKind, string> = {
  validation: 'Validation Error',
  server: 'Server Error',
  network: 'Network Error',
  unauthorized: 'Not Signed In',
  forbidden: 'Permission Denied',
  'not-found': 'Not Found',
  'rate-limited': 'Too Many Requests',
  'file-too-large': 'File Too Large',
  'unsupported-format': 'Unsupported Format',
  unknown: 'Something Went Wrong',
};

function kindFromCode(code?: string): UiErrorKind {
  switch (code) {
    case ApiErrorCode.ValidationError: return 'validation';
    case ApiErrorCode.Unauthorized: return 'unauthorized';
    case ApiErrorCode.Forbidden: return 'forbidden';
    case ApiErrorCode.NotFound: return 'not-found';
    case ApiErrorCode.RateLimited: return 'rate-limited';
    case ApiErrorCode.DocumentTooLarge: return 'file-too-large';
    case ApiErrorCode.UnsupportedFormat: return 'unsupported-format';
    case ApiErrorCode.InternalError:
    case ApiErrorCode.EmbeddingFailed:
    case ApiErrorCode.GraphExtractionFailed:
    case ApiErrorCode.RetrievalFailed:
    case ApiErrorCode.LLMFailed:
    case ApiErrorCode.MemoryWriteFailed:
    case ApiErrorCode.Conflict: return 'server';
    default: return 'unknown';
  }
}

/** Convert a standardized ApiError envelope into a friendly UI error. */
export function friendlyFromApiError(error: ApiError): FriendlyError {
  const kind = kindFromCode(error.code);
  return {
    kind,
    title: KIND_TITLES[kind],
    message: error.message || ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES] || 'An unexpected error occurred.',
    requestId: error.requestId,
    code: error.code,
    details: error.details,
    retryable: kind === 'server' || kind === 'network' || kind === 'rate-limited',
  };
}

/** Convert an arbitrary thrown value into a friendly UI error. */
export function toFriendlyError(error: unknown): FriendlyError {
  if (isApiError(error)) return friendlyFromApiError(error);

  // Network / fetch-level errors.
  if (error instanceof TypeError && /fetch|network|failed to fetch/i.test(error.message)) {
    return {
      kind: 'network',
      title: KIND_TITLES.network,
      message: 'Unable to reach the service. Check your connection and try again.',
      retryable: true,
    };
  }

  if (error instanceof Error) {
    // Heuristic mapping for legacy ad-hoc thrown errors.
    const lower = error.message.toLowerCase();
    if (lower.includes('unsupported file') || lower.includes('unsupported drawing') || lower.includes('unsupported type')) {
      return { kind: 'unsupported-format', title: KIND_TITLES['unsupported-format'], message: error.message, retryable: false };
    }
    if (lower.includes('exceeds') && lower.includes('mb')) {
      return { kind: 'file-too-large', title: KIND_TITLES['file-too-large'], message: error.message, retryable: false };
    }
    if (lower.includes('not found')) {
      return { kind: 'not-found', title: KIND_TITLES['not-found'], message: error.message, retryable: false };
    }
    return { kind: 'unknown', title: KIND_TITLES.unknown, message: error.message, retryable: true };
  }

  return { kind: 'unknown', title: KIND_TITLES.unknown, message: 'An unexpected error occurred.', retryable: true };
}

/**
 * Reads a standardized error envelope from an HTTP response body. Returns null
 * when the body is not a recognized error envelope.
 */
export function extractApiError(payload: unknown): ApiError | null {
  if (isApiError(payload)) return payload;
  return null;
}
