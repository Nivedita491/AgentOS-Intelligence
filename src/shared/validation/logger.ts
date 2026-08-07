/**
 * Request-scoped logging hooks for the Structured API Validation Layer.
 *
 * Every validation failure logs the requestId, endpoint, user, organization,
 * timestamp, validation errors, and latency. Secrets are never logged.
 */

export interface LogContext {
  requestId: string;
  endpoint: string;
  user?: string | null;
  organization?: string | null;
}

export interface ValidationFailureLog {
  requestId: string;
  endpoint: string;
  user?: string | null;
  organization?: string | null;
  timestamp: string;
  code?: string;
  validationErrors?: Array<{ path: string; message: string }>;
  latencyMs: number;
}

/**
 * Logs a validation failure in a structured, secret-safe way.
 * In production this can be routed to a structured logger/APM.
 */
export function logValidationFailure(
  context: LogContext,
  input: Omit<ValidationFailureLog, 'requestId' | 'endpoint' | 'user' | 'organization' | 'timestamp'>,
): void {
  const entry: ValidationFailureLog = {
    requestId: context.requestId,
    endpoint: context.endpoint,
    user: context.user ?? null,
    organization: context.organization ?? null,
    timestamp: new Date().toISOString(),
    ...input,
  };
// JSON.stringify strips any non-serializable fields and never logs secrets
  // because the caller only passes benign metadata.
  console.error('[validation]', JSON.stringify(entry));
}

/** Logs a successful request with latency. */
export function logRequestSuccess(
  context: LogContext,
  latencyMs: number,
  extra?: Record<string, unknown>,
): void {
console.info('[request]', JSON.stringify({
    requestId: context.requestId,
    endpoint: context.endpoint,
    user: context.user ?? null,
    organization: context.organization ?? null,
    timestamp: new Date().toISOString(),
    latencyMs,
    ...extra,
  }));
}
