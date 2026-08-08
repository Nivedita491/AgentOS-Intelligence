import { assertSupabaseConfigured, supabase } from './supabase';
import { isLocalKnowledgeRuntime } from './runtime';
import {
  createLocalDocument,
  deleteLocalAttachment,
  getAssets as getLocalAssets,
  getDocument as getLocalDocument,
  getDocumentAttachments as getLocalDocumentAttachments,
  getDocuments as getLocalDocuments,
  getChunks as getLocalChunks,
  localAttachmentUrl,
  localComplianceFindings,
  localComplianceRules,
  localCopilot,
  localDeleteDocument,
  localEntityEvidence,
  localEvidenceUrl,
  getLocalGraph,
  getLocalSettings,
  getQueries as getLocalQueries,
  localReindexDocument,
  localRagSearch,
  recordLocalSearch,
  removeLocalEvidence,
  saveLocalAttachment,
  saveLocalEvidenceFile,
  saveLocalEvidenceLink,
  saveLocalQuery,
  updateLocalDocumentRecord,
} from './localKnowledge';
import { recordActivity } from './activity';
import type {
  Asset,
  Doc,
  DocChunk,
  Entity,
  EntityRelationship,
  MaintenanceEvent,
  Incident,
  Inspection,
  ComplianceRule,
  ComplianceFinding,
  Alert,
  AIQuery,
  RecommendedAction,
  TimelineEvent,
  AnswerPayload,
  CitationSource,
  QMSRecord,
  EngineeringDrawing,
  WorkingMemoryRecord,
  EpisodicMemoryRecord,
  RetrievalDebug,
  DocumentAttachment,
} from '@/types';
import type { z } from 'zod';
import {
  assertRequest,
  parseResponse,
  generateRequestId,
  isApiError,
  HTTP_STATUS,
  type ApiError,
  CopilotQuerySchema,
  DocumentUploadSchema,
  DocumentActionSchema,
  DocumentUpdateSchema,
  DocumentCreateResponseSchema,
  DocumentActionResponseSchema,
  ForgeAIResponseSchema,
  DocumentAttachmentUploadSchema,
  DocumentAttachmentDeleteSchema,
  DocumentAttachmentListSchema,
  DocumentAttachmentIdSchema,
  SupportingEvidenceUploadSchema,
  EvidenceURLSchema,
  SupportingEvidenceRemoveSchema,
} from '@/shared/validation';

const DOCUMENT_BUCKET = 'organizational-documents';
const DEFAULT_ORGANIZATION_SLUG = 'default';

function edgeUrl(functionName: 'forge-ai' | 'rag-ingest'): string {
  assertSupabaseConfigured();
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
}

// ---------- Assets ----------
export async function fetchAssets(): Promise<Asset[]> {
  if (isLocalKnowledgeRuntime) return getLocalAssets();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('asset_tag');
  if (error) throw error;
  return data as Asset[];
}

export async function fetchAsset(id: string): Promise<Asset | null> {
  if (isLocalKnowledgeRuntime) return getLocalAssets().find((asset) => asset.id === id) ?? null;
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Asset | null;
}

export async function fetchAssetByTag(tag: string): Promise<Asset | null> {
  if (isLocalKnowledgeRuntime) return getLocalAssets().find((asset) => asset.asset_tag.toLowerCase() === tag.toLowerCase()) ?? null;
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('asset_tag', tag)
    .maybeSingle();
  if (error) throw error;
  return data as Asset | null;
}

export async function fetchAssetTimeline(assetId: string): Promise<TimelineEvent[]> {
  const [maint, insp, inc, docs] = await Promise.all([
    supabase.from('maintenance_events').select('*').eq('asset_id', assetId),
    supabase.from('inspections').select('*').eq('asset_id', assetId),
    supabase.from('incidents').select('*').eq('asset_id', assetId),
    supabase.from('documents').select('*').eq('linked_asset_id', assetId),
  ]);

  const events: TimelineEvent[] = [];
  (maint.data as MaintenanceEvent[] | null)?.forEach((m) =>
    events.push({
      id: m.id,
      date: m.event_date,
      type: 'maintenance',
      title: `${m.event_type} — ${m.technician ?? 'Unknown'}`,
      description: m.description,
      source: m.action_taken,
    }),
  );
  (insp.data as Inspection[] | null)?.forEach((i) =>
    events.push({
      id: i.id,
      date: i.completed_date ?? i.due_date ?? i.created_at,
      type: 'inspection',
      title: i.inspection_type,
      description: i.findings,
      source: i.result,
    }),
  );
  (inc.data as Incident[] | null)?.forEach((n) =>
    events.push({
      id: n.id,
      date: n.incident_date,
      type: 'incident',
      title: n.title,
      description: n.symptoms,
      source: n.root_cause,
    }),
  );
  (docs.data as Doc[] | null)?.forEach((d) =>
    events.push({
      id: d.id,
      date: d.uploaded_at,
      type: 'document',
      title: d.filename,
      description: d.document_type,
      source: d.source_department,
    }),
  );
  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  return events;
}

export async function fetchAssetDocuments(assetId: string): Promise<Doc[]> {
  if (isLocalKnowledgeRuntime) return getLocalDocuments().filter((document) => document.linked_asset_id === assetId);
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('linked_asset_id', assetId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data as Doc[]) ?? [];
}

// ---------- Documents ----------
export async function fetchDocuments(): Promise<Doc[]> {
  if (isLocalKnowledgeRuntime) return getLocalDocuments().map((document) => ({ ...document, attachment_count: getLocalDocumentAttachments(document.id).length }));
  const { data, error } = await supabase
    .from('documents')
    .select('*, record_attachments(count)')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Doc & { record_attachments?: Array<{ count: number }> }>).map(({ record_attachments, ...document }) => ({
    ...document,
    attachment_count: record_attachments?.[0]?.count ?? 0,
  }));
}

export async function fetchDocument(id: string): Promise<Doc | null> {
  if (isLocalKnowledgeRuntime) return getLocalDocument(id);
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Doc | null;
}

export async function fetchDocumentChunks(documentId: string): Promise<DocChunk[]> {
  if (isLocalKnowledgeRuntime) return getLocalChunks(documentId);
  const { data, error } = await supabase
    .from('document_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index');
  if (error) throw error;
  return (data as DocChunk[]) ?? [];
}

/** Records local search activity without changing page-level service selection. */
export async function recordDocumentSearch(filters: Record<string, unknown>, resultCount: number): Promise<void> {
  if (isLocalKnowledgeRuntime) recordLocalSearch(filters, resultCount);
}

export async function fetchDocumentAttachments(documentId: string): Promise<DocumentAttachment[]> {
  if (isLocalKnowledgeRuntime) return getLocalDocumentAttachments(documentId);
  const request = assertRequest({ documentId }, DocumentAttachmentListSchema);
  const { data, error } = await supabase
    .from('record_attachments')
    .select('*')
    .eq('document_id', request.documentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as DocumentAttachment[]) ?? [];
}

export interface AttachmentUploadFailure {
  fileName: string;
  message: string;
}

export interface AttachmentUploadSummary {
  uploaded: DocumentAttachment[];
  failed: AttachmentUploadFailure[];
}

const ATTACHMENT_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  txt: 'text/plain', csv: 'text/csv',
};

function attachmentUploadRequest(documentId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = file.type || ATTACHMENT_MIME_TYPES[extension] || '';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${DEFAULT_ORGANIZATION_SLUG}/documents/${documentId}/attachments/${crypto.randomUUID()}-${safeName}`;
  return assertRequest({
    documentId,
    fileName: file.name,
    extension,
    mimeType,
    fileSize: file.size,
    storagePath,
  }, DocumentAttachmentUploadSchema);
}

export async function uploadDocumentAttachment(documentId: string, file: File): Promise<DocumentAttachment> {
  if (isLocalKnowledgeRuntime) return saveLocalAttachment(documentId, file);
  const request = attachmentUploadRequest(documentId, file);
  const { error: storageError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(request.storagePath, file, { contentType: request.mimeType, upsert: false });
  if (storageError) throw storageError;

  try {
    const payload = await invokeRagIngest<{ attachment: DocumentAttachment }>({ action: 'attachment-create', ...request });
    if (!payload.attachment) throw new Error('Attachment metadata could not be saved.');
    return payload.attachment;
  } catch (error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([request.storagePath]);
    throw error;
  }
}

export async function uploadDocumentAttachments(documentId: string, files: File[]): Promise<AttachmentUploadSummary> {
  const uploaded: DocumentAttachment[] = [];
  const failed: AttachmentUploadFailure[] = [];
  for (const file of files) {
    try {
      uploaded.push(await uploadDocumentAttachment(documentId, file));
    } catch (error) {
      failed.push({ fileName: file.name, message: toAttachmentMessage(error) });
    }
  }
  return { uploaded, failed };
}

export async function deleteDocumentAttachment(documentId: string, attachmentId: string): Promise<void> {
  if (isLocalKnowledgeRuntime) return deleteLocalAttachment(documentId, attachmentId);
  const request = assertRequest({ documentId, attachmentId }, DocumentAttachmentDeleteSchema);
  await invokeRagIngest<{ attachmentId: string }>({ action: 'attachment-delete', ...request });
}

export async function getDocumentAttachmentUrl(attachmentId: string, download = false): Promise<string> {
  if (isLocalKnowledgeRuntime) return localAttachmentUrl(attachmentId);
  const request = assertRequest({ attachmentId }, DocumentAttachmentIdSchema);
  const { data: attachment, error: attachmentError } = await supabase
    .from('record_attachments')
    .select('file_name, storage_path')
    .eq('id', request.attachmentId)
    .maybeSingle();
  if (attachmentError) throw attachmentError;
  if (!attachment) throw new Error('Attachment not found.');
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(attachment.storage_path, 60, { download: download ? attachment.file_name : false });
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('A secure attachment link could not be created.');
  return data.signedUrl;
}

const SUPPORTING_EVIDENCE_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
};

function supportingEvidenceUploadRequest(documentId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = file.type || SUPPORTING_EVIDENCE_MIME_TYPES[extension] || '';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${DEFAULT_ORGANIZATION_SLUG}/documents/${documentId}/evidence/${crypto.randomUUID()}-${safeName}`;
  return assertRequest({
    documentId,
    fileName: file.name,
    extension,
    mimeType,
    fileSize: file.size,
    storagePath,
  }, SupportingEvidenceUploadSchema);
}

/** Replaces the document's single supporting-evidence item with a private file. */
export async function saveSupportingEvidenceFile(documentId: string, file: File): Promise<void> {
  if (isLocalKnowledgeRuntime) return saveLocalEvidenceFile(documentId, file);
  const request = supportingEvidenceUploadRequest(documentId, file);
  const { error: storageError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(request.storagePath, file, { contentType: request.mimeType, upsert: false });
  if (storageError) throw storageError;
  try {
    await invokeRagIngest<{ documentId: string }>({ action: 'supporting-evidence-file', ...request });
  } catch (error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([request.storagePath]);
    throw error;
  }
}

/** Replaces the document's single supporting-evidence item with an external HTTP(S) link. */
export async function saveSupportingEvidenceLink(documentId: string, url: string): Promise<void> {
  if (isLocalKnowledgeRuntime) return saveLocalEvidenceLink(documentId, url);
  const request = assertRequest({ documentId, url: url.trim() }, EvidenceURLSchema);
  await invokeRagIngest<{ documentId: string }>({ action: 'supporting-evidence-link', ...request });
}

export async function removeSupportingEvidence(documentId: string): Promise<void> {
  if (isLocalKnowledgeRuntime) return removeLocalEvidence(documentId);
  const request = assertRequest({ documentId }, SupportingEvidenceRemoveSchema);
  await invokeRagIngest<{ documentId: string }>({ action: 'supporting-evidence-remove', ...request });
}

export async function getSupportingEvidenceUrl(document: Doc, download = false): Promise<string | null> {
  if (isLocalKnowledgeRuntime) return localEvidenceUrl(document);
  if (document.supporting_evidence_type === 'link') return document.supporting_url ?? null;
  if (document.supporting_evidence_type !== 'file' || !document.supporting_storage_path) return null;
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.supporting_storage_path, 60, { download: download ? document.supporting_file_name ?? 'supporting-evidence' : false });
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('A secure supporting-evidence link could not be created.');
  return data.signedUrl;
}

function toAttachmentMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Attachment upload failed.';
}

export async function uploadDocument(
  file: File,
  linkedAssetId: string | null,
  onStatus?: (status: string) => void,
  attachments: File[] = [],
): Promise<{ document: Doc; attachmentFailures: AttachmentUploadFailure[] }> {
  if (isLocalKnowledgeRuntime) {
    const document = await createLocalDocument(file, linkedAssetId, onStatus);
    const attachmentFailures: AttachmentUploadFailure[] = [];
    for (const attachment of attachments) {
      try { await saveLocalAttachment(document.id, attachment); }
      catch (error) { attachmentFailures.push({ fileName: attachment.name, message: toAttachmentMessage(error) }); }
    }
    return { document, attachmentFailures };
  }
  onStatus?.('Uploading');
  const allowed = ['pdf', 'txt', 'csv', 'docx', 'pptx', 'xlsx', 'md', 'markdown', 'png', 'jpg', 'jpeg', 'webp'];
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!allowed.includes(ext)) {
    throw new Error(`Unsupported file type: .${ext}. Allowed: ${allowed.join(', ')}`);
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('File exceeds 15 MB limit.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectName = `${crypto.randomUUID()}_${safeName}`;
  const storagePath = `${DEFAULT_ORGANIZATION_SLUG}/documents/${objectName}`;
  const { error: storageError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
  if (storageError) throw storageError;

  let document: Doc | null = null;
  try {
    onStatus?.('Uploaded');
    const createRequest = {
      action: 'create',
      storagePath,
      originalName: file.name,
      mimeType: file.type || mimeTypeForExtension(ext),
      fileSize: file.size,
      linkedAssetId,
      documentType: classifyDocument(file.name),
      department: 'Operations',
    };
    assertRequest(createRequest, DocumentUploadSchema);
    const created = await invokeRagIngest<{ document: Doc }>(createRequest, DocumentCreateResponseSchema);
    document = created.document;
    const actionRequest = assertRequest({ action: 'process', documentId: document.id }, DocumentActionSchema);
    const processing = invokeRagIngest<{ documentId: string }>(actionRequest, DocumentActionResponseSchema);
    let settled = false;
    let processingError: unknown = null;
    void processing.then(
      () => { settled = true; },
      (error) => { processingError = error; settled = true; },
    );
    while (!settled) {
      await delay(700);
      const latest = await fetchDocument(document.id);
      if (latest?.status) onStatus?.(latest.status);
    }
    if (processingError) throw processingError;
    const ready = await fetchDocument(document.id);
    if (!ready) throw new Error('Document indexing completed but the document could not be loaded.');
    let attachmentFailures: AttachmentUploadFailure[] = [];
    if (attachments.length) {
      onStatus?.('Uploading attachments');
      ({ failed: attachmentFailures } = await uploadDocumentAttachments(ready.id, attachments));
    }
    onStatus?.(ready.status);
    return { document: ready, attachmentFailures };
  } catch (error) {
    if (!document) await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw error;
  }
}

export function classifyDocument(filename: string): string {
  const n = filename.toLowerCase();
  if (n.includes('oem') || n.includes('manual')) return 'OEM Manual';
  if (n.includes('sop') || n.includes('standard')) return 'Standard Operating Procedure';
  if (n.includes('inspection')) return 'Inspection Report';
  if (n.includes('incident') || n.includes('near_miss') || n.includes('near-miss'))
    return 'Near-Miss Report';
  if (n.includes('maintenance')) return 'Maintenance Report';
  if (n.includes('compliance') || n.includes('checklist')) return 'Compliance Checklist';
  if (n.includes('handover') || n.includes('shift')) return 'Shift Handover';
  if (n.includes('quality')) return 'Quality Record';
  if (n.includes('work_order') || n.includes('work-order')) return 'Work Order';
  return 'General Engineering Document';
}

function mimeTypeForExtension(extension: string): string {
  const types: Record<string, string> = {
    pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', markdown: 'text/markdown',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  };
  return types[extension] ?? 'application/octet-stream';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/**
 * The Edge Functions return their data fields at the top level of the success
 * envelope (e.g. `{ success: true, requestId, document })`). This helper strips
 * the envelope keys and returns the remainder as the typed payload.
 */
function unwrapEdgePayload<T>(payload: Record<string, unknown>): T {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key !== 'success' && key !== 'requestId') rest[key] = value;
  }
  return rest as unknown as T;
}

/**
 * Invokes a Supabase Edge Function. On success returns the data payload; on
 * failure throws a normalized ApiError so callers render friendly messages
 * with a requestId. Requests carry a requestId header.
 */
async function invokeEdge<T>(
  url: string,
  body: Record<string, unknown>,
  opLabel: string,
  responseSchema?: z.ZodTypeAny,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': generateRequestId(),
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as (Record<string, unknown> & { success?: boolean; requestId?: string; message?: string }) | ApiError | null;

  // Normalize any standard error envelope from the server.
  if (isApiError(payload)) throw payload;

  if (!response.ok || !payload || payload.success !== true) {
    const status = response.status;
    const code = status >= 500
      ? 'INTERNAL_ERROR'
      : status === HTTP_STATUS.NOT_FOUND ? 'NOT_FOUND'
      : status === HTTP_STATUS.UNAUTHORIZED ? 'UNAUTHORIZED'
      : status === HTTP_STATUS.FORBIDDEN ? 'FORBIDDEN'
      : status === HTTP_STATUS.CONFLICT ? 'CONFLICT'
      : status === HTTP_STATUS.DOCUMENT_TOO_LARGE ? 'DOCUMENT_TOO_LARGE'
      : status === HTTP_STATUS.UNSUPPORTED_FORMAT ? 'UNSUPPORTED_FORMAT'
      : status === HTTP_STATUS.RATE_LIMITED ? 'RATE_LIMITED'
      : 'VALIDATION_ERROR';
    throw {
      success: false,
      requestId: payload?.requestId ?? generateRequestId(),
      code,
      message: payload?.message ?? `Service error (${opLabel}, ${status})`,
      timestamp: new Date().toISOString(),
    } as ApiError;
  }

  if (responseSchema) {
    const validation = parseResponse(payload, responseSchema, payload.requestId as string | undefined);
    if (!validation.success) throw validation.error;
  }

  return unwrapEdgePayload<T>(payload);
}

async function invokeRagIngest<T>(body: Record<string, unknown>, responseSchema?: z.ZodTypeAny): Promise<T> {
  return invokeEdge<T>(edgeUrl('rag-ingest'), body, 'Ingestion', responseSchema);
}

export async function reindexDocument(documentId: string): Promise<void> {
  if (isLocalKnowledgeRuntime) return localReindexDocument(documentId);
  const actionRequest = assertRequest({ action: 'reindex', documentId }, DocumentActionSchema);
  await invokeRagIngest<{ documentId: string }>(actionRequest, DocumentActionResponseSchema);
}

export async function deleteDocument(documentId: string): Promise<void> {
  if (isLocalKnowledgeRuntime) return localDeleteDocument(documentId);
  const actionRequest = assertRequest({ action: 'delete', documentId }, DocumentActionSchema);
  await invokeRagIngest<{ documentId: string }>(actionRequest, DocumentActionResponseSchema);
}

export async function updateDocumentRecord(input: {
  documentId: string;
  documentType: string;
  classification: string | null;
  sourceDepartment: string | null;
  status: Doc['status'];
  notes?: string;
  recommendations?: string[];
}): Promise<Doc> {
  const request = assertRequest(input, DocumentUpdateSchema);
  if (isLocalKnowledgeRuntime) return updateLocalDocumentRecord(request);
  const current = await fetchDocument(request.documentId);
  if (!current) throw new Error('Document not found.');
  const { data, error } = await supabase.from('documents').update({
    document_type: request.documentType,
    classification: request.classification,
    source_department: request.sourceDepartment,
    status: request.status,
    metadata_json: { ...(current.metadata_json ?? {}), notes: request.notes ?? '', recommendations: request.recommendations ?? [] },
  }).eq('id', request.documentId).select().single();
  if (error) throw error;
  if (current.organization_id) {
    void recordActivity({ organizationId: current.organization_id, requestId: generateRequestId(), activityType: 'RECORD_UPDATED', category: 'documents', status: 'success', title: 'Record updated', description: current.original_name, documentId: current.id, metadata: { documentName: current.original_name } }).catch(() => undefined);
  }
  return data as Doc;
}

// ---------- Maintenance / Incidents / Inspections ----------
export async function fetchMaintenanceEvents(assetId: string): Promise<MaintenanceEvent[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('maintenance_events')
    .select('*')
    .eq('asset_id', assetId)
    .order('event_date', { ascending: false });
  if (error) throw error;
  return (data as MaintenanceEvent[]) ?? [];
}

export async function fetchIncidents(assetId: string): Promise<Incident[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('asset_id', assetId)
    .order('incident_date', { ascending: false });
  if (error) throw error;
  return (data as Incident[]) ?? [];
}

export async function fetchInspections(assetId: string): Promise<Inspection[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('asset_id', assetId)
    .order('completed_date', { ascending: false });
  if (error) throw error;
  return (data as Inspection[]) ?? [];
}

export async function fetchAllMaintenanceEvents(): Promise<MaintenanceEvent[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('maintenance_events')
    .select('*, assets!inner(asset_tag, name, type, location, health_status)')
    .order('event_date', { ascending: false });
  if (error) throw error;
  return (data as MaintenanceEvent[]) ?? [];
}

export async function fetchAllIncidents(): Promise<Incident[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('incidents')
    .select('*, assets!inner(asset_tag, name, type, location)')
    .order('incident_date', { ascending: false });
  if (error) throw error;
  return (data as Incident[]) ?? [];
}

// ---------- Compliance ----------
export async function fetchComplianceRules(): Promise<ComplianceRule[]> {
  if (isLocalKnowledgeRuntime) return localComplianceRules();
  const { data, error } = await supabase.from('compliance_rules').select('*');
  if (error) throw error;
  return data as ComplianceRule[];
}

export async function fetchComplianceFindings(): Promise<ComplianceFinding[]> {
  if (isLocalKnowledgeRuntime) return localComplianceFindings();
  const { data, error } = await supabase.from('compliance_findings').select('*');
  if (error) throw error;
  return data as ComplianceFinding[];
}

// ---------- Alerts ----------
export async function fetchAlerts(): Promise<Alert[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Alert[];
}

export async function updateAlert(
  id: string,
  patch: Partial<Alert>,
): Promise<void> {
  if (isLocalKnowledgeRuntime) return;
  const { error } = await supabase.from('alerts').update(patch).eq('id', id);
  if (error) throw error;
}

// ---------- AI Queries ----------
export async function fetchAIQueries(limit = 20): Promise<AIQuery[]> {
  if (isLocalKnowledgeRuntime) return getLocalQueries(limit);
  const { data, error } = await supabase
    .from('ai_queries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AIQuery[]) ?? [];
}

export async function copilotQuery(
  query: string,
  assetId?: string | null,
): Promise<{ answer: AnswerPayload; sources: CitationSource[]; fallback: boolean }> {
  const requestBody = { query, assetId, mode: 'generate' as const };
  assertRequest(requestBody, CopilotQuerySchema);
  if (isLocalKnowledgeRuntime) return localCopilot(query);
  const payload = await invokeEdge<{ answer: AnswerPayload }>(edgeUrl('forge-ai'), requestBody, 'Copilot', ForgeAIResponseSchema);
  if (!payload.answer) throw new Error('Invalid AI response');
  return {
    answer: payload.answer,
    sources: (payload.answer.sources ?? []) as CitationSource[],
    fallback: !!payload.answer.fallback,
  };
}

export async function ragSearch(
  query: string,
  filters?: Record<string, unknown>,
): Promise<RetrievalDebug> {
  const requestBody = { query, filters, mode: 'search' as const };
  assertRequest(requestBody, CopilotQuerySchema);
  if (isLocalKnowledgeRuntime) return localRagSearch(query);
  const payload = await invokeEdge<{ retrieval: unknown }>(edgeUrl('forge-ai'), requestBody, 'RAG Search', ForgeAIResponseSchema);
  if (!payload.retrieval || typeof payload.retrieval !== 'object') {
    throw new Error(`RAG search service error: invalid response`);
  }
  return payload.retrieval as RetrievalDebug;
}

export async function saveAIQuery(row: {
  query: string;
  intent?: string | null;
  asset_id?: string | null;
  answer: AnswerPayload;
  confidence?: string | null;
  sources_json?: CitationSource[];
  response_time_ms?: number;
}): Promise<void> {
  if (isLocalKnowledgeRuntime) return saveLocalQuery(row);
  await supabase.from('ai_queries').insert({
    query: row.query,
    intent: row.intent ?? null,
    asset_id: row.asset_id ?? null,
    answer: row.answer,
    confidence: row.confidence ?? row.answer.confidence.level,
    sources_json: row.sources_json ?? row.answer.sources ?? [],
    response_time_ms: row.response_time_ms ?? null,
  });
}

// ---------- Shared memory ----------
export async function fetchWorkingMemory(limit = 20): Promise<WorkingMemoryRecord[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('working_memory')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as WorkingMemoryRecord[]) ?? [];
}

export async function fetchEpisodicMemory(limit = 30): Promise<EpisodicMemoryRecord[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('episodic_memory')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as EpisodicMemoryRecord[]) ?? [];
}

// ---------- Recommended Actions ----------
export async function fetchRecommendedActions(): Promise<RecommendedAction[]> {
  if (isLocalKnowledgeRuntime) return [];
  const { data, error } = await supabase
    .from('recommended_actions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as RecommendedAction[]) ?? [];
}

export async function createRecommendedAction(
  action: Omit<RecommendedAction, 'id' | 'created_at'>,
): Promise<RecommendedAction | null> {
  if (isLocalKnowledgeRuntime) return null;
  const { data, error } = await supabase
    .from('recommended_actions')
    .insert(action)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as RecommendedAction | null;
}

export async function updateRecommendedAction(
  id: string,
  patch: Partial<RecommendedAction>,
): Promise<void> {
  if (isLocalKnowledgeRuntime) return;
  const { error } = await supabase
    .from('recommended_actions')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

// ---------- Knowledge Graph ----------
export async function fetchGraphData(): Promise<{
  entities: Entity[];
  relationships: EntityRelationship[];
}> {
  if (isLocalKnowledgeRuntime) return getLocalGraph();
  const [e, r] = await Promise.all([
    supabase.from('entities').select('*'),
    supabase.from('entity_relationships').select('*'),
  ]);
  if (e.error) throw e.error;
  if (r.error) throw r.error;
  return {
    entities: (e.data as Entity[]) ?? [],
    relationships: (r.data as EntityRelationship[]) ?? [],
  };
}

export async function fetchAssetGraph(
  assetId: string,
): Promise<{ entities: Entity[]; relationships: EntityRelationship[] }> {
  if (isLocalKnowledgeRuntime) {
    const graph = getLocalGraph();
    const asset = getLocalAssets().find((item) => item.id === assetId);
    const anchor = graph.entities.find((entity) => entity.entity_type === 'Asset' && entity.normalized_name === asset?.asset_tag.toLowerCase());
    if (!anchor) return { entities: [], relationships: [] };
    const related = graph.relationships.filter((relationship) => relationship.source_entity_id === anchor.id || relationship.target_entity_id === anchor.id);
    const ids = new Set([anchor.id, ...related.flatMap((relationship) => [relationship.source_entity_id, relationship.target_entity_id])]);
    return { entities: graph.entities.filter((entity) => ids.has(entity.id)), relationships: related };
  }
  const { data: asset } = await supabase
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle();
  if (!asset) return { entities: [], relationships: [] };
  const tag = (asset as Asset).asset_tag.toLowerCase();
  const { data: ents } = await supabase
    .from('entities')
    .select('*')
    .or(`normalized_name.eq.${tag},entity_type.eq.Location`);
  const assetEntity = (ents as Entity[] | null)?.find(
    (x) => x.normalized_name === tag && x.entity_type === 'Asset',
  );
  if (!assetEntity) return { entities: [], relationships: [] };

  const { data: relsOut } = await supabase
    .from('entity_relationships')
    .select('*')
    .eq('source_entity_id', assetEntity.id);
  const { data: relsIn } = await supabase
    .from('entity_relationships')
    .select('*')
    .eq('target_entity_id', assetEntity.id);
  const rels = [
    ...((relsOut as EntityRelationship[]) ?? []),
    ...((relsIn as EntityRelationship[]) ?? []),
  ];
  const relatedIds = new Set<string>([assetEntity.id]);
  rels.forEach((r) => {
    relatedIds.add(r.source_entity_id);
    relatedIds.add(r.target_entity_id);
  });
  const { data: relatedEnts } = await supabase
    .from('entities')
    .select('*')
    .in('id', Array.from(relatedIds));
  return {
    entities: (relatedEnts as Entity[]) ?? [],
    relationships: rels,
  };
}

export async function fetchEntityEvidence(entityId: string): Promise<Array<{
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  confidence: number | null;
}>> {
  if (isLocalKnowledgeRuntime) return localEntityEvidence(entityId).map((item) => ({ ...item, confidence: 1 }));
  const { data, error } = await supabase
    .from('entity_mentions')
    .select('confidence, document_chunks!inner(id, document_id, content, page_number, section_title, documents!inner(id, original_name))')
    .eq('entity_id', entityId)
    .limit(12);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    confidence: number | null;
    document_chunks: {
      id: string;
      document_id: string;
      content: string;
      page_number: number | null;
      section_title: string | null;
      documents: { id: string; original_name: string } | Array<{ id: string; original_name: string }>;
    } | Array<{
      id: string;
      document_id: string;
      content: string;
      page_number: number | null;
      section_title: string | null;
      documents: { id: string; original_name: string } | Array<{ id: string; original_name: string }>;
    }>;
  }>).flatMap((row) => {
    const chunk = Array.isArray(row.document_chunks) ? row.document_chunks[0] : row.document_chunks;
    if (!chunk) return [];
    const document = Array.isArray(chunk.documents) ? chunk.documents[0] : chunk.documents;
    if (!document) return [];
    return [{
      chunkId: chunk.id,
      documentId: chunk.document_id,
      documentName: document.original_name,
      content: chunk.content,
      pageNumber: chunk.page_number,
      sectionTitle: chunk.section_title,
      confidence: row.confidence,
    }];
  });
}

// ---------- Settings ----------
export async function fetchSettings(): Promise<Record<string, unknown>> {
  if (isLocalKnowledgeRuntime) return getLocalSettings();
  const { data, error } = await supabase.from('app_settings').select('*');
  if (error) throw error;
  const out: Record<string, unknown> = {};
  (data as { key: string; value: unknown }[] | null)?.forEach((row) => {
    out[row.key] = row.value;
  });
  return out;
}

// ---------- QMS ----------
export async function fetchQMSRecords(recordType?: string): Promise<QMSRecord[]> {
  let q = supabase.from('qms_records').select('*').order('created_at', { ascending: false });
  if (recordType && recordType !== 'all') {
    q = q.eq('record_type', recordType);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as QMSRecord[]) ?? [];
}

export async function fetchQMSRecord(id: string): Promise<QMSRecord | null> {
  const { data, error } = await supabase
    .from('qms_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as QMSRecord | null;
}

export async function fetchAssetQMSRecords(assetId: string): Promise<QMSRecord[]> {
  const { data, error } = await supabase
    .from('qms_records')
    .select('*')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as QMSRecord[]) ?? [];
}

export async function createQMSRecord(
  record: Omit<QMSRecord, 'id' | 'created_at' | 'updated_at'>,
): Promise<QMSRecord | null> {
  const { data, error } = await supabase
    .from('qms_records')
    .insert(record)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as QMSRecord | null;
}

export async function updateQMSRecord(
  id: string,
  patch: Partial<QMSRecord>,
): Promise<void> {
  const { error } = await supabase.from('qms_records').update(patch).eq('id', id);
  if (error) throw error;
}

// ---------- Engineering Drawings ----------
export async function fetchDrawings(): Promise<EngineeringDrawing[]> {
  const { data, error } = await supabase
    .from('engineering_drawings')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data as EngineeringDrawing[]) ?? [];
}

export async function fetchAssetDrawings(assetId: string): Promise<EngineeringDrawing[]> {
  const { data, error } = await supabase
    .from('engineering_drawings')
    .select('*')
    .eq('linked_asset_id', assetId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data as EngineeringDrawing[]) ?? [];
}

// Deterministic OCR extraction for engineering drawings
export function extractDrawingEntities(text: string): {
  tags: string[];
  instruments: string[];
  labels: string[];
} {
  const tags = new Set<string>();
  const instruments = new Set<string>();
  const labels = new Set<string>();

  // Asset tags: P-204, B-07, FT-204, etc.
  const tagPattern = /\b([A-Z]{1,3}-\d{2,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(text)) !== null) tags.add(m[1]);

  // Instrument tags: FT-204, TT-204, PI-204, LT-07, TIC-07, etc.
  const instPattern = /\b(FT|TT|PI|LT|TIC|FIC|SV|PSV|HS|LIC|FI|TI|PDIT)-\d{2,3}\b/g;
  while ((m = instPattern.exec(text)) !== null) {
    const tag = m[0];
    const typeMap: Record<string, string> = {
      FT: 'Flow Transmitter', TT: 'Temperature Transmitter', PI: 'Pressure Indicator',
      LT: 'Level Transmitter', TIC: 'Temperature Controller', FIC: 'Flow Controller',
      SV: 'Safety Valve', PSV: 'Pressure Safety Valve', HS: 'Hand Switch',
      LIC: 'Level Controller', FI: 'Flow Indicator', TI: 'Temperature Indicator',
      PDIT: 'Pressure Differential Indicator Transmitter',
    };
    const prefix = tag.split('-')[0];
    instruments.add(`${tag}:${typeMap[prefix] ?? 'Instrument'}`);
  }

  // Labels: lines that look like labels (uppercase words, locations)
  const labelPattern = /^(.+)$/gm;
  while ((m = labelPattern.exec(text)) !== null) {
    const line = m[1].trim();
    if (line.length > 3 && line.length < 60 && /^[A-Z0-9\s/&-]+$/.test(line) && !tags.has(line)) {
      labels.add(line);
    }
  }

  return {
    tags: Array.from(tags),
    instruments: Array.from(instruments),
    labels: Array.from(labels).slice(0, 10),
  };
}

export async function uploadDrawing(
  file: File,
  linkedAssetId: string | null,
  onStatus?: (status: string) => void,
): Promise<EngineeringDrawing> {
  onStatus?.('Uploading');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['pdf', 'png', 'jpg', 'jpeg', 'txt'].includes(ext)) {
    throw new Error(`Unsupported drawing type: .${ext}. Allowed: pdf, png, jpg, txt`);
  }
  if (file.size > 15 * 1024 * 1024) throw new Error('File exceeds 15 MB limit.');

  onStatus?.('OCR Processing');
  let ocrText = '';
  try {
    ocrText = await file.text();
  } catch {
    ocrText = `[Binary drawing file: ${file.name}. OCR requires server-side processing.]`;
  }

  onStatus?.('Detecting Tags');
  const { tags, instruments, labels } = extractDrawingEntities(ocrText);

  onStatus?.('Extracting Entities');
  const drawingType = file.name.toLowerCase().includes('pid') || file.name.toLowerCase().includes('p&id')
    ? 'P&ID'
    : file.name.toLowerCase().includes('layout')
      ? 'Equipment Layout'
      : 'Engineering Drawing';

  onStatus?.('Storing');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const { data, error } = await supabase
    .from('engineering_drawings')
    .insert({
      filename: `${Date.now()}_${safeName}`,
      original_name: file.name,
      drawing_type: drawingType,
      status: 'Processed',
      linked_asset_id: linkedAssetId,
      ocr_text: ocrText,
      detected_tags: tags,
      detected_instruments: instruments,
      detected_labels: labels,
      extracted_entities: tags,
      metadata_json: { vision_agent: 'deterministic-ocr', originalSize: file.size },
    })
    .select()
    .single();
  if (error) throw error;

  onStatus?.('Processed');
  return data as EngineeringDrawing;
}
