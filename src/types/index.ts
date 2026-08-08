// ForgeMind AI — shared domain types

export type HealthStatus = 'Healthy' | 'Monitor' | 'At Risk' | 'Critical';
export type Criticality = 'Low' | 'Medium' | 'High' | 'Critical';
export type AlertSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type AlertStatus = 'Open' | 'Acknowledged' | 'Resolved';
export type ComplianceStatus = 'Compliant' | 'Due Soon' | 'Overdue' | 'Missing Evidence';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type DocumentStatus =
  | 'Uploaded'
  | 'Extracting'
  | 'Parsing'
  | 'Chunking'
  | 'Embedding'
  | 'Graph Building'
  | 'Indexed'
  | 'Ready'
  | 'Failed';

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  type: string;
  location: string;
  manufacturer: string | null;
  model: string | null;
  installation_date: string | null;
  criticality: Criticality;
  health_status: HealthStatus;
  health_score: number;
  last_maintenance_date: string | null;
  next_inspection_date: string | null;
  current_observations: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Doc {
  id: string;
  organization_id?: string;
  filename: string;
  original_name: string;
  mime_type: string | null;
  file_size: number;
  document_type: string;
  classification: string | null;
  status: DocumentStatus;
  linked_asset_id: string | null;
  source_department: string | null;
  uploaded_at: string;
  parsed_text: string | null;
  metadata_json: Record<string, unknown> | null;
  error_message: string | null;
  page_count: number | null;
  storage_path?: string | null;
  processing_stage?: 'uploaded' | 'extracting' | 'chunking' | 'embedding' | 'graph_building' | 'ready' | 'failed';
  processing_error?: { stage?: string; message?: string; occurredAt?: string } | null;
  document_version?: number;
  effective_from?: string | null;
  effective_until?: string | null;
  is_current?: boolean;
  updated_at?: string;
  attachment_count?: number;
  supporting_evidence_type?: 'file' | 'link' | null;
  supporting_file_name?: string | null;
  supporting_storage_path?: string | null;
  supporting_mime_type?: string | null;
  supporting_file_size?: number | null;
  supporting_url?: string | null;
  supporting_uploaded_at?: string | null;
}

export interface DocumentAttachment {
  id: string;
  document_id: string;
  organization_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DocChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section_name: string | null;
  metadata_json: Record<string, unknown> | null;
  content_hash?: string | null;
  section_title?: string | null;
  heading_path?: string[];
  source_type?: string | null;
  mime_type?: string | null;
  token_count?: number;
  start_offset?: number | null;
  end_offset?: number | null;
}

export interface Entity {
  id: string;
  entity_type: string;
  name: string;
  normalized_name: string;
  ontology_class: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface EntityRelationship {
  id: string;
  source_entity_id: string;
  relationship_type: string;
  target_entity_id: string;
  evidence_document_id: string | null;
  confidence: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface MaintenanceEvent {
  id: string;
  asset_id: string;
  event_date: string;
  event_type: string;
  description: string | null;
  technician: string | null;
  downtime_hours: number | null;
  findings: string | null;
  action_taken: string | null;
  source_document_id: string | null;
  created_at: string;
}

export interface Incident {
  id: string;
  asset_id: string;
  incident_date: string;
  title: string;
  symptoms: string | null;
  root_cause: string | null;
  severity: string;
  downtime_hours: number | null;
  corrective_action: string | null;
  source_document_id: string | null;
  created_at: string;
}

export interface Inspection {
  id: string;
  asset_id: string;
  inspection_type: string;
  completed_date: string | null;
  due_date: string | null;
  result: string | null;
  findings: string | null;
  source_document_id: string | null;
  created_at: string;
}

export interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scope_asset_type: string | null;
  interval_days: number;
  severity: string;
  configured_source: string;
  created_at: string;
}

export interface ComplianceFinding {
  id: string;
  compliance_rule_id: string;
  asset_id: string;
  last_evidence_date: string | null;
  due_date: string | null;
  status: string;
  days_overdue: number;
  evidence_document_id: string | null;
  recommended_action: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Alert {
  id: string;
  asset_id: string | null;
  type: string;
  title: string;
  description: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  evidence_document_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AIQuery {
  id: string;
  query: string;
  intent: string | null;
  asset_id: string | null;
  answer: AnswerPayload | null;
  confidence: string | null;
  sources_json: CitationSource[] | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface RecommendedAction {
  id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  source_query_id: string | null;
  due_date: string | null;
  created_at: string;
}

// AI answer schema
export interface Finding {
  finding: string;
  evidenceIds: string[];
}

export interface ProbableCause {
  cause: string;
  confidence: ConfidenceLevel;
  evidenceIds: string[];
}

export interface CitationSource {
  documentId: string;
  documentName: string;
  chunkId?: string;
  page: number | null;
  section: string;
  excerpt?: string;
  sourceType?: string | null;
  similarityScore?: number | null;
}

export interface Confidence {
  level: ConfidenceLevel;
  score: number;
  basis: string;
}

export interface AgentTraceStep {
  agent: string;
  role: string;
  action: string;
  evidenceCount: number;
  status: 'completed' | 'skipped' | 'error';
  detail?: string;
}

export interface RetrievalInfo {
  vector: { count: number; sources: string[] };
  lexical?: { count: number; sources: string[] };
  metadata: { count: number; sources: string[] };
  knowledgeGraph: { count: number; sources: string[] };
}

export interface RetrievalCandidateDebug {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  headingPath: string[];
  sourceType: string | null;
  semanticScore?: number;
  lexicalScore?: number;
  graphScore?: number;
  metadataScore?: number;
  fusedScore?: number;
  rerankScore?: number;
  traversal?: string[];
}

export interface RetrievalDebug {
  query: string;
  rewrittenQueries: string[];
  embeddingCreated: boolean;
  embeddingModel: string;
  warnings: string[];
  vectorResults: RetrievalCandidateDebug[];
  lexicalResults: RetrievalCandidateDebug[];
  metadataResults: RetrievalCandidateDebug[];
  graphResults: RetrievalCandidateDebug[];
  fusionResults: RetrievalCandidateDebug[];
  finalResults: RetrievalCandidateDebug[];
}

export interface WorkingMemoryRecord {
  id: string;
  task_id: string;
  organization_id: string;
  original_query: string;
  rewritten_queries: string[];
  retrieved_chunk_ids: string[];
  discovered_entities: string[];
  current_plan: string[];
  intermediate_outputs: Record<string, unknown>;
  current_status: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface EpisodicMemoryRecord {
  id: string;
  execution_id: string;
  task_id: string | null;
  organization_id: string;
  query: string;
  agents_used: string[];
  retrieved_evidence: CitationSource[];
  final_output: AnswerPayload | null;
  success: boolean;
  confidence: number | null;
  latency_ms: number | null;
  created_at: string;
}

// ============ Activity history ============
export type ActivityType =
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_PROCESSING_STARTED'
  | 'EMBEDDING_GENERATION_COMPLETED'
  | 'DOCUMENT_INDEXED'
  | 'DOCUMENT_REINDEXED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_ATTACHMENT_UPLOADED'
  | 'DOCUMENT_ATTACHMENT_DELETED'
  | 'RECORD_CREATED'
  | 'RECORD_UPDATED'
  | 'RECORD_EVIDENCE_ATTACHED'
  | 'RECORD_EVIDENCE_REMOVED'
  | 'RECORD_SEARCH_EXECUTED'
  | 'RECORD_REPORT_EXPORTED'
  | 'LOCAL_KNOWLEDGE_QUERY_COMPLETED'
  | 'RAG_QUERY_STARTED'
  | 'RAG_QUERY_COMPLETED'
  | 'RAG_QUERY_FAILED'
  | 'RETRIEVAL_COMPLETED'
  | 'COPILOT_RESPONSE_GENERATED'
  | 'GRAPH_EXTRACTION_COMPLETED'
  | 'MEMORY_WRITTEN'
  | 'SETTINGS_UPDATED'
  | 'ERROR_OCCURRED'
  | 'AGENT_STARTED'
  | 'AGENT_COMPLETED'
  | 'AGENT_FAILED'
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED';

export type ActivityCategory = 'documents' | 'rag' | 'ai' | 'graph' | 'memory' | 'system' | 'agents';
export type ActivityStatus = 'success' | 'failed' | 'running' | 'warning';

export interface ActivityEvent {
  id: string;
  organization_id: string;
  user_id: string | null;
  request_id: string | null;
  activity_type: ActivityType;
  category: ActivityCategory;
  status: ActivityStatus;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  document_id: string | null;
  task_id: string | null;
  agent_name: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  error_code: string | null;
  created_at: string;
}

export interface CreateActivityEvent {
  organizationId: string;
  userId?: string | null;
  requestId?: string | null;
  activityType: ActivityType;
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

export interface ActivityHistoryQuery {
  organizationId?: string;
  activityType?: ActivityType;
  category?: ActivityCategory;
  status?: ActivityStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface AnswerPayload {
  directAnswer: string;
  keyFindings: Finding[];
  probableCauses: ProbableCause[];
  recommendedActions: string[];
  riskNote: string;
  sources: CitationSource[];
  confidence: Confidence;
  intent?: string;
  assetTag?: string | null;
  fallback?: boolean;
  agentTrace?: AgentTraceStep[];
  retrieval?: RetrievalInfo;
  qmsFindings?: QMSFinding[];
  citations?: Array<{
    documentId: string;
    documentName: string;
    chunkId: string;
    pageNumber: number | null;
    sectionTitle: string | null;
    similarityScore: number | null;
    sourceType: string | null;
  }>;
  retrievalDebug?: RetrievalDebug;
  memory?: { taskId: string; executionId: string };
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: 'maintenance' | 'inspection' | 'incident' | 'document' | 'ai' | 'qms';
  title: string;
  description: string | null;
  source: string | null;
}

// ============ QMS ============
export type QMSRecordType =
  | 'Deviation'
  | 'CAPA'
  | 'NCR'
  | 'AuditFinding'
  | 'CorrectiveAction'
  | 'PreventiveAction'
  | 'TrainingRecord'
  | 'QualityEvent'
  | 'BatchInvestigation';

export interface QMSRecord {
  id: string;
  record_type: QMSRecordType;
  code: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  owner: string | null;
  department: string | null;
  asset_id: string | null;
  linked_document_id: string | null;
  linked_incident_id: string | null;
  linked_maintenance_id: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  due_date: string | null;
  closed_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface QMSFinding {
  code: string;
  recordType: QMSRecordType;
  title: string;
  status: string;
  relevance: 'direct' | 'contextual';
}

// ============ Engineering Drawings ============
export interface EngineeringDrawing {
  id: string;
  filename: string;
  original_name: string;
  drawing_type: string;
  status: string;
  linked_asset_id: string | null;
  uploaded_at: string;
  ocr_text: string | null;
  detected_tags: string[];
  detected_instruments: string[];
  detected_labels: string[];
  extracted_entities: string[];
  metadata_json: Record<string, unknown> | null;
  error_message: string | null;
}

// ============ Ontology ============
export type OntologyClass =
  | 'Asset'
  | 'Equipment'
  | 'Component'
  | 'Subsystem'
  | 'MaintenanceActivity'
  | 'Inspection'
  | 'Incident'
  | 'FailureMode'
  | 'Symptom'
  | 'CorrectiveAction'
  | 'PreventiveAction'
  | 'SafetyProcedure'
  | 'OperatingProcedure'
  | 'QualityRecord'
  | 'Deviation'
  | 'CAPA'
  | 'NCR'
  | 'Audit'
  | 'Technician'
  | 'Department'
  | 'Location'
  | 'Document'
  | 'Procedure'
  | 'ComplianceRequirement'
  | 'Risk'
  | 'Drawing';

export interface OntologyEntity extends Entity {
  ontology_class: string | null;
}
