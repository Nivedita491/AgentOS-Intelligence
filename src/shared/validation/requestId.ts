/**
 * Request ID generation for the Structured API Validation Layer.
 *
 * A requestId is attached to every request, log line, response, and error so the
 * frontend can display a stable reference when something goes wrong.
 */

/** Generates a RFC-4122 v4 UUID used as a request identifier. */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-web environments (e.g. some test runners).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Format a requestId for display in the UI (shorter prefix). */
export function shortRequestId(requestId: string): string {
  return requestId.slice(0, 8);
}
