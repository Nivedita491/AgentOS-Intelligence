import type {
  ActivityEvent,
  ActivityHistoryQuery,
  AIQuery,
  AnswerPayload,
  Asset,
  CitationSource,
  ComplianceFinding,
  ComplianceRule,
  Doc,
  DocChunk,
  DocumentAttachment,
  Entity,
  EntityRelationship,
  RetrievalDebug,
} from '@/types';

const DOCUMENTS_KEY = 'agentos.local.documents.v1';
const ATTACHMENTS_KEY = 'agentos.local.attachments.v1';
const ACTIVITY_KEY = 'agentos.local.activity.v1';
const QUERIES_KEY = 'agentos.local.queries.v1';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

const now = () => new Date().toISOString();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : clone(fallback);
  } catch {
    return clone(fallback);
  }
};
const save = <T,>(key: string, value: T) => window.localStorage.setItem(key, JSON.stringify(value));

const seedDate = '2026-07-01T09:00:00.000Z';
const docId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function seedDocument(
  n: number,
  filename: string,
  type: string,
  category: string,
  status: Doc['status'],
  text: string,
  tags: string[],
  notes: string,
  recommendations: string[],
  evidence: Partial<Doc> = {},
): Doc {
  return {
    id: docId(n), organization_id: ORGANIZATION_ID, filename, original_name: filename,
    mime_type: 'application/pdf', file_size: 120_000 + n * 5_000, document_type: type,
    classification: category, status, linked_asset_id: n <= 3 ? '20000000-0000-4000-8000-000000000204' : null,
    source_department: n <= 3 ? 'Product Operations' : 'Corporate Strategy',
    uploaded_at: `2026-07-${String(n).padStart(2, '0')}T09:00:00.000Z`,
    updated_at: `2026-07-${String(n + 1).padStart(2, '0')}T11:30:00.000Z`,
    parsed_text: text,
    metadata_json: { tags, notes, recommendations, localSeed: true },
    error_message: null, page_count: 2 + (n % 4), processing_stage: status === 'Ready' ? 'ready' : status === 'Failed' ? 'failed' : 'uploaded',
    ...evidence,
  };
}

const seedDocuments: Doc[] = [
  seedDocument(1, 'Project Aurora Launch Brief.pdf', 'Project Brief', 'Corporate Strategy', 'Ready', 'Project Aurora is the company-wide launch of the Aurora analytics platform. Maya Chen, Chief Executive Officer, sponsors the programme. The Q4 launch campaign is managed by Elena Ruiz and targets enterprise operations executives and digital transformation leaders.', ['aurora', 'launch', 'executives', 'campaign'], 'The launch brief is the governing source for programme ownership and audience.', ['Keep executive audience messaging aligned to operational outcomes.', 'Review launch readiness weekly.'], { supporting_evidence_type: 'file', supporting_file_name: 'aurora-launch-map.png', supporting_storage_path: 'local://seed/aurora-launch-map.png', supporting_mime_type: 'image/png', supporting_file_size: 68, supporting_uploaded_at: seedDate }),
  seedDocument(2, 'Aurora Pricing Framework.pdf', 'Pricing Strategy', 'Commercial', 'Ready', 'Aurora is priced as an annual enterprise subscription. The standard platform tier is 120,000 USD per year and the scale tier is 240,000 USD per year. A 15 percent launch incentive is available only for signed Q4 contracts.', ['aurora', 'pricing', 'subscription', 'q4'], 'Pricing changes require Commercial Steering approval.', ['Use the approved price card in customer proposals.', 'Confirm incentive eligibility before discounting.'], { supporting_evidence_type: 'link', supporting_url: 'https://example.com/aurora-pricing', supporting_uploaded_at: seedDate }),
  seedDocument(3, 'Aurora Technology Architecture.pdf', 'Technical Architecture', 'Technology', 'Ready', 'The Aurora platform uses a React operations console, a TypeScript service layer, PostgreSQL for durable records, and a governed retrieval pipeline. The platform integrates event telemetry through secure APIs and uses role-based access controls.', ['aurora', 'technology', 'react', 'postgresql', 'api'], 'Architecture decisions are maintained by the Platform Engineering team.', ['Validate API access controls before production onboarding.']),
  seedDocument(4, 'Launch Campaign Operating Plan.pdf', 'Campaign Plan', 'Marketing', 'Ready', 'Elena Ruiz, Vice President of Growth, manages the Aurora launch campaign. The campaign targets chief operating officers, vice presidents of operations, and transformation directors at enterprise manufacturers. The campaign combines executive briefings, partner webinars, and account-based outreach.', ['campaign', 'elena ruiz', 'executives', 'aurora'], 'Campaign milestones are reviewed every Monday.', ['Prioritize named enterprise accounts.', 'Track executive briefing conversion.'], { supporting_evidence_type: 'link', supporting_url: 'https://example.com/aurora-campaign', supporting_uploaded_at: seedDate }),
  seedDocument(5, 'Leadership and Ownership Directory.pdf', 'Organizational Profile', 'Corporate Governance', 'Ready', 'Maya Chen is the Chief Executive Officer of NovaWorks. Daniel Okafor is Chief Product Officer. Elena Ruiz is Vice President of Growth and owns the launch campaign. Priya Nair leads Platform Engineering.', ['maya chen', 'ceo', 'leadership', 'elena ruiz'], 'Use this directory for approved programme ownership references.', ['Refresh ownership after organisational changes.']),
  seedDocument(6, 'Enterprise Audience Research.pdf', 'Market Research', 'Audience Insights', 'Indexed', 'Research shows that operations executives need evidence of measurable throughput, quality, and downtime improvements. The highest-value audience is enterprise manufacturers with multi-site operations and complex production planning.', ['audience', 'operations executives', 'manufacturing', 'research'], 'The audience research supports campaign targeting and positioning.', ['Lead with measurable operational outcomes.']),
  seedDocument(7, 'Data Governance Policy.pdf', 'Policy', 'Governance', 'Ready', 'Aurora customer data is classified as confidential. Access is granted through role-based controls, audit logging, and least-privilege approval. Customer exports require a documented business purpose.', ['governance', 'data', 'policy', 'access'], 'This policy applies to all Aurora programme teams.', ['Review export controls before customer rollout.']),
  seedDocument(8, 'Competitive Positioning Notes.pdf', 'Market Analysis', 'Commercial', 'Uploaded', 'Aurora is positioned as an operations intelligence platform that connects project, campaign, product, and technology evidence into one governed workspace. Its differentiation is traceable evidence rather than unsupported summaries.', ['competitive', 'positioning', 'evidence'], 'Positioning notes are awaiting final Commercial approval.', ['Use only approved differentiators in external material.']),
  seedDocument(9, 'Partner Enablement Playbook.pdf', 'Enablement Playbook', 'Partners', 'Ready', 'Implementation partners use the Aurora API integration guide, the executive value narrative, and the pricing framework. Partners may not offer launch incentives without Commercial approval.', ['partners', 'enablement', 'api', 'pricing'], 'Partner teams require enablement certification before launch.', ['Publish the approved enablement checklist.']),
  seedDocument(10, 'Aurora Steering Committee Readout.pdf', 'Meeting Notes', 'Corporate Strategy', 'Failed', 'The steering committee confirmed Q4 as the target launch window. The team requested a pricing review, executive audience validation, and a final technology readiness assessment before public launch.', ['steering committee', 'q4', 'readout', 'aurora'], 'The failed processing status reflects the source file extraction attempt; this local record retains its captured meeting text.', ['Complete the requested readiness reviews.']),
];

const assets: Asset[] = [
  { id: '20000000-0000-4000-8000-000000000204', asset_tag: 'P-204', name: 'Aurora Operations Programme', type: 'Digital Product', location: 'Global', manufacturer: null, model: 'Aurora', installation_date: '2026-01-15', criticality: 'High', health_status: 'Healthy', health_score: 91, last_maintenance_date: null, next_inspection_date: '2026-10-01', current_observations: ['Q4 launch readiness in progress'], created_at: seedDate, updated_at: seedDate },
  { id: '20000000-0000-4000-8000-000000000205', asset_tag: 'AUR-API', name: 'Aurora Integration API', type: 'Platform Service', location: 'Cloud', manufacturer: null, model: 'v1', installation_date: '2026-03-01', criticality: 'High', health_status: 'Monitor', health_score: 84, last_maintenance_date: null, next_inspection_date: '2026-09-15', current_observations: ['Partner integration review due'], created_at: seedDate, updated_at: seedDate },
];

const chunks = (): DocChunk[] => getDocuments().map((document, index) => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  document_id: document.id, chunk_index: 0, content: document.parsed_text ?? '', page_number: 1,
  section_name: 'Record summary', section_title: 'Record summary', metadata_json: { local: true },
  content_hash: `local-${document.id}`, heading_path: ['Record summary'], source_type: 'local-document', mime_type: document.mime_type,
  token_count: (document.parsed_text ?? '').split(/\s+/).filter(Boolean).length, start_offset: 0, end_offset: document.parsed_text?.length ?? 0,
}));

const entities: Entity[] = [
  ['40000000-0000-4000-8000-000000000001', 'Organization', 'NovaWorks', 'novaworks', 1],
  ['40000000-0000-4000-8000-000000000002', 'Project', 'Project Aurora', 'project aurora', 1],
  ['40000000-0000-4000-8000-000000000003', 'Product', 'Aurora analytics platform', 'aurora analytics platform', 1],
  ['40000000-0000-4000-8000-000000000004', 'Person', 'Maya Chen', 'maya chen', 5],
  ['40000000-0000-4000-8000-000000000005', 'Person', 'Elena Ruiz', 'elena ruiz', 4],
  ['40000000-0000-4000-8000-000000000006', 'Technology', 'PostgreSQL', 'postgresql', 3],
  ['40000000-0000-4000-8000-000000000007', 'Campaign', 'Aurora launch campaign', 'aurora launch campaign', 4],
  ['40000000-0000-4000-8000-000000000008', 'Document', 'Aurora Pricing Framework', 'aurora pricing framework', 2],
  ['40000000-0000-4000-8000-000000000009', 'Asset', 'P-204', 'p-204', 1],
].map(([id, entity_type, name, normalized_name, documentNumber]) => ({ id: id as string, entity_type: entity_type as string, name: name as string, normalized_name: normalized_name as string, ontology_class: entity_type as string, metadata_json: { documentId: docId(documentNumber as number), local: true }, created_at: seedDate }));

const relations: EntityRelationship[] = [
  ['50000000-0000-4000-8000-000000000001', 1, 2, 'DEVELOPS', 1], ['50000000-0000-4000-8000-000000000002', 2, 3, 'RELATED_TO', 1],
  ['50000000-0000-4000-8000-000000000003', 1, 4, 'MANAGED_BY', 5], ['50000000-0000-4000-8000-000000000004', 7, 5, 'MANAGED_BY', 4],
  ['50000000-0000-4000-8000-000000000005', 3, 6, 'USES', 3], ['50000000-0000-4000-8000-000000000006', 7, 3, 'TARGETS', 4],
  ['50000000-0000-4000-8000-000000000007', 9, 2, 'RELATED_TO', 1], ['50000000-0000-4000-8000-000000000008', 8, 3, 'RELATED_TO', 2],
  ['50000000-0000-4000-8000-000000000009', 9, 6, 'USES', 3], ['50000000-0000-4000-8000-000000000010', 9, 7, 'RELATED_TO', 4],
].map(([id, source, target, relationship_type, evidence]) => ({ id: id as string, source_entity_id: entities[(source as number) - 1].id, target_entity_id: entities[(target as number) - 1].id, relationship_type: relationship_type as string, evidence_document_id: docId(evidence as number), confidence: 'high', metadata_json: { local: true }, created_at: seedDate }));

const seedActivities: ActivityEvent[] = [
  { id: '60000000-0000-4000-8000-000000000001', organization_id: ORGANIZATION_ID, user_id: null, request_id: 'local-seed-aurora', activity_type: 'DOCUMENT_INDEXED', category: 'documents', status: 'success', title: 'Local knowledge corpus loaded', description: 'Project Aurora launch brief', entity_type: 'document', entity_id: docId(1), document_id: docId(1), task_id: null, agent_name: null, duration_ms: 0, metadata: { documentName: 'Project Aurora Launch Brief.pdf', local: true }, error_code: null, created_at: seedDate },
];

export function getDocuments(): Doc[] { return load(DOCUMENTS_KEY, seedDocuments).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)); }
function saveDocuments(documents: Doc[]) { save(DOCUMENTS_KEY, documents); }
export function getAssets(): Asset[] { return clone(assets); }
export function getDocument(id: string): Doc | null { return getDocuments().find((document) => document.id === id) ?? null; }
export function getChunks(documentId: string): DocChunk[] { return chunks().filter((chunk) => chunk.document_id === documentId); }

export function appendLocalActivity(input: Omit<Partial<ActivityEvent>, 'id' | 'organization_id' | 'created_at' | 'metadata'> & { activity_type: ActivityEvent['activity_type']; category: ActivityEvent['category']; status: ActivityEvent['status']; title: string; metadata?: Record<string, unknown> }): ActivityEvent {
  const event: ActivityEvent = {
    id: crypto.randomUUID(), organization_id: ORGANIZATION_ID, user_id: null, request_id: input.request_id ?? `local-${crypto.randomUUID()}`,
    activity_type: input.activity_type, category: input.category, status: input.status, title: input.title,
    description: input.description ?? null, entity_type: input.entity_type ?? null, entity_id: input.entity_id ?? null,
    document_id: input.document_id ?? null, task_id: input.task_id ?? null, agent_name: input.agent_name ?? null,
    duration_ms: input.duration_ms ?? null, metadata: { ...(input.metadata ?? {}), runtime: 'local' }, error_code: input.error_code ?? null, created_at: now(),
  };
  save(ACTIVITY_KEY, [event, ...load(ACTIVITY_KEY, seedActivities)]);
  return event;
}

export function getActivity(input: ActivityHistoryQuery = {}): { events: ActivityEvent[]; hasMore: boolean } {
  const search = input.search?.toLowerCase().trim();
  const items = load(ACTIVITY_KEY, seedActivities).filter((event) => {
    const haystack = `${event.title} ${event.description ?? ''} ${event.activity_type} ${event.metadata.documentName ?? ''}`.toLowerCase();
    return (!input.category || event.category === input.category) && (!input.status || event.status === input.status)
      && (!input.activityType || event.activity_type === input.activityType) && (!input.dateFrom || event.created_at >= input.dateFrom)
      && (!input.dateTo || event.created_at <= input.dateTo) && (!search || haystack.includes(search));
  });
  const offset = input.offset ?? 0; const limit = input.limit ?? 25;
  return { events: items.slice(offset, offset + limit), hasMore: items.length > offset + limit };
}

export function createLocalDocument(file: File, linkedAssetId: string | null, onStatus?: (status: string) => void): Promise<Doc> {
  return new Promise((resolve, reject) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowed = ['pdf', 'txt', 'csv', 'docx', 'pptx', 'xlsx', 'md', 'markdown', 'png', 'jpg', 'jpeg', 'webp'];
    if (!allowed.includes(extension)) { reject(new Error(`Unsupported file type: .${extension}.`)); return; }
    if (file.size > 15 * 1024 * 1024) { reject(new Error('File exceeds 15 MB limit.')); return; }
    onStatus?.('Uploading');
    window.setTimeout(async () => {
      try {
        onStatus?.('Extracting');
        const text = /^text\//.test(file.type) || ['txt', 'csv', 'md', 'markdown'].includes(extension)
          ? (await file.text()).slice(0, 40_000)
          : `Local record created from ${file.name}. The original file is retained in this browser for offline review.`;
        onStatus?.('Chunking');
        const document: Doc = {
          id: crypto.randomUUID(), organization_id: ORGANIZATION_ID, filename: file.name, original_name: file.name,
          mime_type: file.type || 'application/octet-stream', file_size: file.size, document_type: 'Organizational Document', classification: 'Local Records',
          status: 'Ready', linked_asset_id: linkedAssetId, source_department: 'Local Workspace', uploaded_at: now(), updated_at: now(), parsed_text: text,
          metadata_json: { tags: ['local'], notes: 'Created in Local Knowledge mode.', recommendations: [] }, error_message: null, page_count: null, processing_stage: 'ready',
        };
        saveDocuments([document, ...getDocuments()]);
        appendLocalActivity({ activity_type: 'RECORD_CREATED', category: 'documents', status: 'success', title: 'Local record created', description: document.original_name, document_id: document.id, entity_type: 'document', entity_id: document.id, metadata: { documentName: document.original_name } });
        onStatus?.('Ready');
        resolve(document);
      } catch (error) { reject(error); }
    }, 250);
  });
}

function updateDocument(id: string, patch: Partial<Doc>): Doc {
  const documents = getDocuments(); const index = documents.findIndex((document) => document.id === id);
  if (index < 0) throw new Error('Document not found.');
  const updated = { ...documents[index], ...patch, updated_at: now() };
  documents[index] = updated; saveDocuments(documents); return updated;
}

export function updateLocalDocumentRecord(input: { documentId: string; documentType: string; classification: string | null; sourceDepartment: string | null; status: Doc['status']; notes?: string; recommendations?: string[] }): Doc {
  const current = getDocument(input.documentId); if (!current) throw new Error('Document not found.');
  const document = updateDocument(input.documentId, {
    document_type: input.documentType,
    classification: input.classification,
    source_department: input.sourceDepartment,
    status: input.status,
    metadata_json: { ...(current.metadata_json ?? {}), notes: input.notes ?? '', recommendations: input.recommendations ?? [] },
  });
  appendLocalActivity({ activity_type: 'RECORD_UPDATED', category: 'documents', status: 'success', title: 'Local record updated', description: document.original_name, document_id: document.id, metadata: { documentName: document.original_name } });
  return document;
}

const dbName = 'agentos-local-evidence';
function evidenceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function putBlob(key: string, blob: Blob) { const database = await evidenceDb(); await new Promise<void>((resolve, reject) => { const tx = database.transaction('files', 'readwrite'); tx.objectStore('files').put(blob, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); database.close(); }
async function getBlob(key: string): Promise<Blob | null> { const database = await evidenceDb(); const value = await new Promise<Blob | null>((resolve, reject) => { const tx = database.transaction('files', 'readonly'); const req = tx.objectStore('files').get(key); req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null); req.onerror = () => reject(req.error); }); database.close(); return value; }
async function deleteBlob(key: string) { const database = await evidenceDb(); await new Promise<void>((resolve, reject) => { const tx = database.transaction('files', 'readwrite'); tx.objectStore('files').delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); database.close(); }

const seedEvidenceData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLzWQAAAABJRU5ErkJggg==';
export async function saveLocalEvidenceFile(documentId: string, file: File): Promise<void> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const allowed = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'];
  if (!allowed.includes(extension) || file.size <= 0 || file.size > 10 * 1024 * 1024 || /[\\/\0]/.test(file.name)) throw new Error('Supporting evidence must be a safe PDF, DOCX, or image under 10 MB.');
  await putBlob(`evidence:${documentId}`, file);
  updateDocument(documentId, { supporting_evidence_type: 'file', supporting_file_name: file.name, supporting_storage_path: `local://evidence/${documentId}`, supporting_mime_type: file.type || 'application/octet-stream', supporting_file_size: file.size, supporting_url: null, supporting_uploaded_at: now() });
  const document = getDocument(documentId)!;
  appendLocalActivity({ activity_type: 'RECORD_EVIDENCE_ATTACHED', category: 'documents', status: 'success', title: 'Local supporting evidence attached', description: file.name, document_id: documentId, metadata: { documentName: document.original_name, evidenceType: 'file', fileName: file.name } });
}

export function saveLocalEvidenceLink(documentId: string, value: string): void {
  let url: URL; try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid HTTP(S) evidence URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Enter a valid HTTP(S) evidence URL.');
  const document = updateDocument(documentId, { supporting_evidence_type: 'link', supporting_file_name: null, supporting_storage_path: null, supporting_mime_type: null, supporting_file_size: null, supporting_url: url.toString(), supporting_uploaded_at: now() });
  void deleteBlob(`evidence:${documentId}`);
  appendLocalActivity({ activity_type: 'RECORD_EVIDENCE_ATTACHED', category: 'documents', status: 'success', title: 'Local supporting evidence linked', description: document.supporting_url, document_id: documentId, metadata: { documentName: document.original_name, evidenceType: 'link' } });
}

export async function removeLocalEvidence(documentId: string): Promise<void> {
  const document = getDocument(documentId); if (!document) throw new Error('Document not found.');
  await deleteBlob(`evidence:${documentId}`);
  updateDocument(documentId, { supporting_evidence_type: null, supporting_file_name: null, supporting_storage_path: null, supporting_mime_type: null, supporting_file_size: null, supporting_url: null, supporting_uploaded_at: null });
  appendLocalActivity({ activity_type: 'RECORD_EVIDENCE_REMOVED', category: 'documents', status: 'success', title: 'Local supporting evidence removed', description: document.original_name, document_id: documentId, metadata: { documentName: document.original_name } });
}

export async function localEvidenceUrl(document: Doc): Promise<string | null> {
  if (document.supporting_evidence_type === 'link') return document.supporting_url ?? null;
  if (document.supporting_storage_path === 'local://seed/aurora-launch-map.png') return seedEvidenceData;
  const blob = await getBlob(`evidence:${document.id}`); return blob ? URL.createObjectURL(blob) : null;
}

export function localDeleteDocument(documentId: string): void {
  const document = getDocument(documentId); if (!document) throw new Error('Document not found.');
  saveDocuments(getDocuments().filter((item) => item.id !== documentId));
  save(ATTACHMENTS_KEY, getAttachments().filter((attachment) => attachment.document_id !== documentId));
  void deleteBlob(`evidence:${documentId}`);
  appendLocalActivity({ activity_type: 'DOCUMENT_DELETED', category: 'documents', status: 'success', title: 'Local record deleted', description: document.original_name, document_id: documentId, metadata: { documentName: document.original_name } });
}
export function localReindexDocument(documentId: string): void { const document = updateDocument(documentId, { status: 'Ready', processing_stage: 'ready', error_message: null }); appendLocalActivity({ activity_type: 'DOCUMENT_REINDEXED', category: 'documents', status: 'success', title: 'Local record reindexed', description: document.original_name, document_id: documentId, metadata: { documentName: document.original_name } }); }

export function getAttachments(): DocumentAttachment[] { return load(ATTACHMENTS_KEY, [] as DocumentAttachment[]); }
export function getDocumentAttachments(documentId: string): DocumentAttachment[] { return getAttachments().filter((attachment) => attachment.document_id === documentId); }
export async function saveLocalAttachment(documentId: string, file: File): Promise<DocumentAttachment> {
  const attachment: DocumentAttachment = { id: crypto.randomUUID(), document_id: documentId, organization_id: ORGANIZATION_ID, file_name: file.name, storage_path: `local://attachment/${documentId}`, mime_type: file.type || null, file_size: file.size, uploaded_by: null, created_at: now() };
  await putBlob(`attachment:${attachment.id}`, file); save(ATTACHMENTS_KEY, [attachment, ...getAttachments()]);
  appendLocalActivity({ activity_type: 'DOCUMENT_ATTACHMENT_UPLOADED', category: 'documents', status: 'success', title: 'Local attachment added', description: file.name, document_id: documentId, metadata: { attachmentId: attachment.id, fileName: file.name } }); return attachment;
}
export async function localAttachmentUrl(attachmentId: string): Promise<string> { const blob = await getBlob(`attachment:${attachmentId}`); if (!blob) throw new Error('Attachment is unavailable in local storage.'); return URL.createObjectURL(blob); }
export async function deleteLocalAttachment(documentId: string, attachmentId: string): Promise<void> { const attachment = getAttachments().find((item) => item.id === attachmentId && item.document_id === documentId); if (!attachment) throw new Error('Attachment not found.'); await deleteBlob(`attachment:${attachmentId}`); save(ATTACHMENTS_KEY, getAttachments().filter((item) => item.id !== attachmentId)); appendLocalActivity({ activity_type: 'DOCUMENT_ATTACHMENT_DELETED', category: 'documents', status: 'success', title: 'Local attachment removed', description: attachment.file_name, document_id: documentId, metadata: { attachmentId } }); }

const retrievalStopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'by', 'can', 'do', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'current']);
function tokens(text: string) { return (text.toLowerCase().match(/[a-z0-9-]{2,}/g) ?? []).filter((token) => !retrievalStopWords.has(token)); }
function localSources(query: string): CitationSource[] {
  const baseTokens = tokens(query);
  const queryTokens = [...new Set(baseTokens.flatMap((token) => token === 'ceo' ? ['ceo', 'chief', 'executive', 'officer'] : [token]))];
  return getDocuments().map((document) => {
    const title = `${document.filename} ${document.document_type} ${document.classification ?? ''} ${((document.metadata_json?.tags as string[] | undefined) ?? []).join(' ')}`.toLowerCase();
    const text = `${title} ${document.parsed_text ?? ''}`;
    const matches = queryTokens.filter((token) => text.includes(token)).length;
    const titleMatches = queryTokens.filter((token) => title.includes(token)).length;
    const phrase = text.includes(query.toLowerCase().trim()) ? 8 : 0;
    const divisor = Math.max(queryTokens.length, 1);
    return { document, score: Math.min(100, Math.round((titleMatches / divisor) * 55 + (matches / divisor) * 45 + phrase)), matches };
  }).filter((item) => item.matches > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(({ document, score }) => ({ documentId: document.id, documentName: document.original_name, chunkId: getChunks(document.id)[0]?.id, page: 1, section: 'Record summary', excerpt: (document.parsed_text ?? '').slice(0, 260), sourceType: 'local-document', similarityScore: score }));
}

export function localCopilot(query: string): { answer: AnswerPayload; sources: CitationSource[]; fallback: boolean } {
  const sources = localSources(query);
  const top = sources[0];
  const answer: AnswerPayload = !top ? {
    directAnswer: "I couldn't find sufficient evidence in the available knowledge.", keyFindings: [], probableCauses: [], recommendedActions: [], riskNote: '', sources: [], confidence: { level: 'low', score: 0, basis: 'No matching local evidence' }, intent: 'local-evidence-search', agentTrace: [], retrieval: { vector: { count: 0, sources: [] }, lexical: { count: 0, sources: [] }, metadata: { count: 0, sources: [] }, knowledgeGraph: { count: 0, sources: [] } },
  } : {
    directAnswer: `Based on ${top.documentName}: ${top.excerpt}`,
    keyFindings: sources.slice(0, 3).map((source) => ({ finding: source.excerpt ?? source.documentName, evidenceIds: [source.documentId] })), probableCauses: [],
    recommendedActions: ((getDocument(top.documentId)?.metadata_json?.recommendations as string[] | undefined) ?? []).slice(0, 3),
    riskNote: 'This response is grounded in locally stored record evidence.', sources,
    confidence: { level: (top.similarityScore ?? 0) >= 65 ? 'high' : 'medium', score: top.similarityScore ?? 0, basis: 'Local relevance score from matching record text, metadata, and entities' },
    intent: 'local-evidence-search', agentTrace: [{ agent: 'Local Retrieval', role: 'offline knowledge', action: 'Ranked matching local records', evidenceCount: sources.length, status: 'completed' }],
    retrieval: { vector: { count: 0, sources: [] }, lexical: { count: sources.length, sources: sources.map((source) => source.documentName) }, metadata: { count: sources.length, sources: sources.map((source) => source.documentName) }, knowledgeGraph: { count: sources.length, sources: sources.map((source) => source.documentName) } },
  };
  appendLocalActivity({ activity_type: 'LOCAL_KNOWLEDGE_QUERY_COMPLETED', category: 'ai', status: 'success', title: 'Local knowledge query completed', description: query.slice(0, 500), metadata: { sourceCount: sources.length } });
  return { answer, sources, fallback: true };
}

export function localRagSearch(query: string): RetrievalDebug {
  const sources = localSources(query);
  const results = sources.map((source) => ({ chunkId: source.chunkId ?? source.documentId, documentId: source.documentId, documentName: source.documentName, content: source.excerpt ?? '', pageNumber: source.page, sectionTitle: source.section, headingPath: [source.section], sourceType: 'local-document', lexicalScore: source.similarityScore ?? undefined, metadataScore: source.similarityScore ?? undefined, fusedScore: source.similarityScore ?? undefined, rerankScore: source.similarityScore ?? undefined }));
  return { query, rewrittenQueries: [], embeddingCreated: false, embeddingModel: 'local-token-ranking', warnings: ['Local Knowledge mode: scores are deterministic relevance scores, not embeddings.'], vectorResults: [], lexicalResults: results, metadataResults: results, graphResults: results, fusionResults: results, finalResults: results };
}

export function getLocalGraph() { return { entities: clone(entities), relationships: clone(relations) }; }
export function localEntityEvidence(entityId: string) { const entity = entities.find((item) => item.id === entityId); const documentId = entity?.metadata_json?.documentId as string | undefined; return documentId ? getChunks(documentId).map((chunk) => ({ chunkId: chunk.id, documentId, documentName: getDocument(documentId)?.original_name ?? 'Document', content: chunk.content, pageNumber: chunk.page_number, sectionTitle: chunk.section_title ?? null })) : []; }

export function getQueries(limit = 20): AIQuery[] { return load(QUERIES_KEY, [] as AIQuery[]).slice(0, limit); }
export function saveLocalQuery(row: { query: string; intent?: string | null; asset_id?: string | null; answer: AnswerPayload; confidence?: string | null; sources_json?: CitationSource[]; response_time_ms?: number }): void { const item: AIQuery = { id: crypto.randomUUID(), query: row.query, intent: row.intent ?? null, asset_id: row.asset_id ?? null, answer: row.answer, confidence: row.confidence ?? row.answer.confidence.level, sources_json: row.sources_json ?? row.answer.sources, response_time_ms: row.response_time_ms ?? null, created_at: now() }; save(QUERIES_KEY, [item, ...getQueries(100)]); }

export function getLocalSettings(): Record<string, unknown> { return { facility_name: 'NovaWorks Local Workspace', facility_type: 'Knowledge Operations', facility_location: 'Offline browser storage', ai_provider: 'Unavailable', gemini_available: false, runtime: 'Local Knowledge', backend: 'Offline' }; }
export function localComplianceRules(): ComplianceRule[] { return []; }
export function localComplianceFindings(): ComplianceFinding[] { return []; }
export function recordLocalSearch(filters: Record<string, unknown>, resultCount: number) { appendLocalActivity({ activity_type: 'RECORD_SEARCH_EXECUTED', category: 'documents', status: 'success', title: 'Local record search executed', description: typeof filters.keyword === 'string' ? filters.keyword : 'Filters applied', metadata: { filters, resultCount } }); }
