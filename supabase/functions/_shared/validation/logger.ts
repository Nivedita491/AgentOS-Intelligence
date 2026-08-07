// Request-scoped logging hooks for the Edge Function validation layer.
// Logs requestId, endpoint, operation, timestamp, errors, and latency.
// Never logs secrets.

export interface LogContext {
  requestId: string;
  endpoint: string;
  operation?: string;
  user?: string | null;
  organization?: string | null;
}

export function logFailure(context: LogContext, input: Record<string, unknown>): void {
  console.error("[validation]", JSON.stringify({
    requestId: context.requestId,
    endpoint: context.endpoint,
    operation: context.operation,
    user: context.user ?? null,
    organization: context.organization ?? null,
    timestamp: new Date().toISOString(),
    ...input,
  }));
}

export function logSuccess(context: LogContext, latencyMs: number, extra?: Record<string, unknown>): void {
  console.info("[request]", JSON.stringify({
    requestId: context.requestId,
    endpoint: context.endpoint,
    operation: context.operation,
    user: context.user ?? null,
    organization: context.organization ?? null,
    timestamp: new Date().toISOString(),
    latencyMs,
    ...extra,
  }));
}
