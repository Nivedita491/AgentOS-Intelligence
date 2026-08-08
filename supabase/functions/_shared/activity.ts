import type { SupabaseClient } from "npm:@supabase/supabase-js@2.58.0";

type ActivityStatus = "success" | "failed" | "running" | "warning";
type ActivityCategory = "documents" | "rag" | "ai" | "graph" | "memory" | "system" | "agents";

export interface ActivityInput {
  organizationId: string;
  requestId?: string | null;
  activityType: string;
  category: ActivityCategory;
  status: ActivityStatus;
  title: string;
  description?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  documentId?: string | null;
  taskId?: string | null;
  agentName?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
  errorCode?: string | null;
}

/** Activity writes are best-effort: audit availability must not break the user action. */
export async function recordActivity(supabase: SupabaseClient, event: ActivityInput): Promise<void> {
  const { error } = await supabase.from("activity_events").insert({
    organization_id: event.organizationId,
    request_id: event.requestId ?? null,
    activity_type: event.activityType,
    category: event.category,
    status: event.status,
    title: event.title.slice(0, 240),
    description: event.description?.slice(0, 2000) ?? null,
    entity_type: event.entityType?.slice(0, 120) ?? null,
    entity_id: event.entityId?.slice(0, 255) ?? null,
    document_id: event.documentId ?? null,
    task_id: event.taskId?.slice(0, 160) ?? null,
    agent_name: event.agentName?.slice(0, 160) ?? null,
    duration_ms: event.durationMs ?? null,
    metadata: event.metadata ?? {},
    error_code: event.errorCode?.slice(0, 120) ?? null,
  });
  if (error) console.error("activity-event write failed", { activityType: event.activityType, requestId: event.requestId, code: error.code });
}
