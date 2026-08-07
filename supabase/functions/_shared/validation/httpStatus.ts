// HTTP status constants for the Edge Function validation layer.

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_TYPE: 415,
  PROCESSING_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type HttpStatusCode = typeof HttpStatus[keyof typeof HttpStatus];
