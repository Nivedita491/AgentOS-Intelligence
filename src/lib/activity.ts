import { supabase } from './supabase';
import type { ActivityEvent, ActivityHistoryQuery, CreateActivityEvent } from '@/types';
import { ActivityHistoryQuerySchema, CreateActivityEventSchema, assertRequest } from '@/shared/validation';

export interface ActivityHistoryPage {
  events: ActivityEvent[];
  hasMore: boolean;
}

/** Ensures metadata is JSON-safe before it becomes durable activity history. */
export function serializeActivityMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(metadata ?? {})) as Record<string, unknown>;
  } catch {
    throw new Error('Activity metadata must be JSON-serializable.');
  }
}

export async function recordActivity(input: CreateActivityEvent): Promise<ActivityEvent> {
  const event = assertRequest({ ...input, metadata: serializeActivityMetadata(input.metadata) }, CreateActivityEventSchema);
  const { data, error } = await supabase
    .from('activity_events')
    .insert({
      organization_id: event.organizationId,
      user_id: event.userId ?? null,
      request_id: event.requestId ?? null,
      activity_type: event.activityType,
      category: event.category,
      status: event.status,
      title: event.title,
      description: event.description ?? null,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      document_id: event.documentId ?? null,
      task_id: event.taskId ?? null,
      agent_name: event.agentName ?? null,
      duration_ms: event.durationMs ?? null,
      metadata: event.metadata,
      error_code: event.errorCode ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ActivityEvent;
}

export async function fetchActivityHistory(input: ActivityHistoryQuery = {}): Promise<ActivityHistoryPage> {
  const query = assertRequest(input, ActivityHistoryQuerySchema);
  let request = supabase
    .from('activity_events')
    .select('*')
    .order('created_at', { ascending: false })
    .range(query.offset, query.offset + query.limit);

  if (query.organizationId) request = request.eq('organization_id', query.organizationId);
  if (query.activityType) request = request.eq('activity_type', query.activityType);
  if (query.category) request = request.eq('category', query.category);
  if (query.status) request = request.eq('status', query.status);
  if (query.dateFrom) request = request.gte('created_at', query.dateFrom);
  if (query.dateTo) request = request.lte('created_at', query.dateTo);
  if (query.search) {
    const term = query.search.replace(/[,%()]/g, ' ').trim();
    if (term) {
      request = request.or([
        `title.ilike.%${term}%`,
        `description.ilike.%${term}%`,
        `request_id.ilike.%${term}%`,
        `activity_type.ilike.%${term}%`,
        `agent_name.ilike.%${term}%`,
        `metadata->>documentName.ilike.%${term}%`,
      ].join(','));
    }
  }

  const { data, error } = await request;
  if (error) throw error;
  const rows = (data as ActivityEvent[] | null) ?? [];
  return { events: rows.slice(0, query.limit), hasMore: rows.length > query.limit };
}

export function searchActivityHistory(search: string, filters: Omit<ActivityHistoryQuery, 'search'> = {}): Promise<ActivityHistoryPage> {
  return fetchActivityHistory({ ...filters, search });
}

export async function getRecentActivity(limit = 8): Promise<ActivityEvent[]> {
  const { events } = await fetchActivityHistory({ limit });
  return events;
}
