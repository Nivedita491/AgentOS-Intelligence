// Standard error codes and HTTP status mapping for the Edge Function validation layer.
// This is the authoritative server-side security boundary.

export const ApiErrorCode = {
  ValidationError: "VALIDATION_ERROR",
  Unauthorized: "UNAUTHORIZED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  Conflict: "CONFLICT",
  RateLimited: "RATE_LIMITED",
  DocumentTooLarge: "DOCUMENT_TOO_LARGE",
  UnsupportedFormat: "UNSUPPORTED_FORMAT",
  EmbeddingFailed: "EMBEDDING_FAILED",
  GraphExtractionFailed: "GRAPH_EXTRACTION_FAILED",
  RetrievalFailed: "RETRIEVAL_FAILED",
  LLMFailed: "LLM_FAILED",
  MemoryWriteFailed: "MEMORY_WRITE_FAILED",
  InternalError: "INTERNAL_ERROR",
} as const;

export type ApiErrorCodeValue = typeof ApiErrorCode[keyof typeof ApiErrorCode];

export const HTTP_STATUS: Record<ApiErrorCodeValue, number> = {
  [ApiErrorCode.ValidationError]: 400,
  [ApiErrorCode.Unauthorized]: 401,
  [ApiErrorCode.Forbidden]: 403,
  [ApiErrorCode.NotFound]: 404,
  [ApiErrorCode.Conflict]: 409,
  [ApiErrorCode.RateLimited]: 429,
  [ApiErrorCode.DocumentTooLarge]: 413,
  [ApiErrorCode.UnsupportedFormat]: 415,
  [ApiErrorCode.EmbeddingFailed]: 422,
  [ApiErrorCode.GraphExtractionFailed]: 422,
  [ApiErrorCode.RetrievalFailed]: 422,
  [ApiErrorCode.LLMFailed]: 422,
  [ApiErrorCode.MemoryWriteFailed]: 422,
  [ApiErrorCode.InternalError]: 500,
};

export const ERROR_MESSAGES: Record<ApiErrorCodeValue, string> = {
  [ApiErrorCode.ValidationError]: "The request contains invalid or missing fields.",
  [ApiErrorCode.Unauthorized]: "You are not signed in to perform this action.",
  [ApiErrorCode.Forbidden]: "You do not have permission to perform this action.",
  [ApiErrorCode.NotFound]: "The requested resource could not be found.",
  [ApiErrorCode.Conflict]: "The request conflicts with the current state of the resource.",
  [ApiErrorCode.RateLimited]: "Too many requests. Please try again shortly.",
  [ApiErrorCode.DocumentTooLarge]: "The uploaded file exceeds the maximum allowed size.",
  [ApiErrorCode.UnsupportedFormat]: "The uploaded file format is not supported.",
  [ApiErrorCode.EmbeddingFailed]: "The document could not be embedded for retrieval.",
  [ApiErrorCode.GraphExtractionFailed]: "Knowledge graph extraction failed for this document.",
  [ApiErrorCode.RetrievalFailed]: "Retrieval failed. Please try again.",
  [ApiErrorCode.LLMFailed]: "The language model could not generate a response.",
  [ApiErrorCode.MemoryWriteFailed]: "The result could not be written to shared memory.",
  [ApiErrorCode.InternalError]: "An unexpected error occurred. Please try again.",
};

export function codeForStatus(status: number): ApiErrorCodeValue {
  if (status === 401) return ApiErrorCode.Unauthorized;
  if (status === 403) return ApiErrorCode.Forbidden;
  if (status === 404) return ApiErrorCode.NotFound;
  if (status === 409) return ApiErrorCode.Conflict;
  if (status === 413) return ApiErrorCode.DocumentTooLarge;
  if (status === 415) return ApiErrorCode.UnsupportedFormat;
  if (status === 422) return ApiErrorCode.ValidationError;
  if (status === 429) return ApiErrorCode.RateLimited;
  if (status >= 500) return ApiErrorCode.InternalError;
  return ApiErrorCode.ValidationError;
}
