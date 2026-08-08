import documents from './documents.json';
import chunks from './chunks.json';
import entities from './entities.json';
import relationships from './relationships.json';
import memoryData from './memory.json';
import { rankFallbackChunks } from './fallbackRetriever';
import type {
  Asset,
  Doc,
  DocChunk,
  Entity,
  EntityRelationship,
  AIQuery,
  AnswerPayload,
  CitationSource,
  WorkingMemoryRecord,
  EpisodicMemoryRecord,
  RetrievalDebug,
  RetrievalCandidateDebug,
} from '@/types';

const localQueries: AIQuery[] = [];
let workingMemory: WorkingMemoryRecord[] = memoryData.working as WorkingMemoryRecord[];
let episodicMemory: EpisodicMemoryRecord[] = memoryData.episodic as EpisodicMemoryRecord[];

function findDocument(id: string): Doc | null {
  return (documents.find((doc) => doc.id === id) as Doc | undefined) ?? null;
}

export async function fetchFallbackAssets(): Promise<Asset[]> {
  return Promise.resolve([]);
}

export async function fetchFallbackDocuments(): Promise<Doc[]> {
  return Promise.resolve(documents as Doc[]);
}

export async function fetchFallbackDocument(id: string): Promise<Doc | null> {
  return Promise.resolve(findDocument(id));
}

export async function fetchFallbackDocumentChunks(documentId: string): Promise<DocChunk[]> {
  return Promise.resolve(chunks.filter((chunk) => chunk.document_id === documentId));
}

export async function uploadFallbackDocument(): Promise<never> {
  return Promise.reject(new Error('Document ingestion requires a live backend connection.'));
}

export async function fetchFallbackAlerts() {
  return Promise.resolve([]);
}

export async function fetchFallbackComplianceFindings() {
  return Promise.resolve([]);
}

export async function fetchFallbackAIQueries(limit = 20): Promise<AIQuery[]> {
  return Promise.resolve(localQueries.slice(0, limit));
}

export async function saveFallbackAIQuery(row: {
  query: string;
  intent?: string | null;
  asset_id?: string | null;
  answer: AnswerPayload;
  confidence?: string | null;
  sources_json?: CitationSource[];
  response_time_ms?: number;
}): Promise<void> {
  const newQuery: AIQuery = {
    id: `fallback-${Date.now()}`,
    query: row.query,
    intent: row.intent ?? null,
    asset_id: row.asset_id ?? null,
    answer: row.answer,
    confidence: row.confidence ?? row.answer.confidence.level,
    sources_json: row.sources_json ?? row.answer.sources ?? [],
    response_time_ms: row.response_time_ms ?? null,
    created_at: new Date().toISOString(),
  };
  localQueries.unshift(newQuery);
  if (localQueries.length > 50) localQueries.pop();
}

export async function fetchFallbackWorkingMemory(limit = 20): Promise<WorkingMemoryRecord[]> {
  return Promise.resolve(workingMemory.slice(0, limit));
}

export async function fetchFallbackEpisodicMemory(limit = 30): Promise<EpisodicMemoryRecord[]> {
  return Promise.resolve(episodicMemory.slice(0, limit));
}

export async function fetchFallbackGraphData(): Promise<{ entities: Entity[]; relationships: EntityRelationship[] }> {
  return Promise.resolve({ entities: entities as Entity[], relationships: relationships as EntityRelationship[] });
}

export async function fetchFallbackEntityEvidence(entityId: string) {
  const entity = entities.find((item) => item.id === entityId);
  if (!entity) return Promise.resolve([]);
  const normalized = entity.normalized_name.toLowerCase();
  const matches = chunks.filter((chunk) => chunk.content.toLowerCase().includes(normalized));
  return Promise.resolve(matches.slice(0, 5).map((chunk) => ({
    chunkId: chunk.id,
    documentId: chunk.document_id,
    documentName: findDocument(chunk.document_id)?.filename ?? 'Fallback document',
    content: chunk.content,
    pageNumber: chunk.page_number,
    sectionTitle: chunk.section_title ?? chunk.section_name,
    confidence: null,
  })));
}

export async function fetchFallbackSettings() {
  return Promise.resolve({
    facility_name: 'NovaTech Labs Demo Factory',
    facility_type: 'Intelligence Platform Prototype',
    facility_location: 'Bengaluru, India',
    ai_provider: 'Local Knowledge',
    gemini_available: false,
    runtimeMode: 'fallback',
  });
}

function createCitations(chunksList: DocChunk[], query: string): CitationSource[] {
  return chunksList.slice(0, 3).map((chunk) => ({
    documentId: chunk.document_id,
    documentName: findDocument(chunk.document_id)?.filename ?? 'Fallback document',
    chunkId: chunk.id,
    page: chunk.page_number,
    section: chunk.section_title ?? chunk.section_name ?? 'Document',
    excerpt: chunk.content.slice(0, 160),
    sourceType: 'fallback',
    similarityScore: null,
  }));
}

export async function fallbackCopilotQuery(query: string) {
  const matched = rankFallbackChunks(chunks as DocChunk[], query);
  const evidence = matched.slice(0, 3);
  const sources = createCitations(evidence.map((item) => ({
    id: item.chunkId,
    document_id: item.documentId,
    chunk_index: 0,
    content: item.content,
    page_number: item.pageNumber,
    section_name: item.sectionTitle ?? null,
    metadata_json: {},
    section_title: item.sectionTitle,
    heading_path: [],
  } as DocChunk)), query);

  const directAnswer = evidence.length > 0
    ? evidence[0].content
    : 'I could not find sufficient evidence in the available knowledge.';

  const answer: AnswerPayload = {
    directAnswer,
    keyFindings: evidence.length > 0 ? [{ finding: `Evidence was sourced from ${sources[0].documentName}.`, evidenceIds: [evidence[0].chunkId] }] : [],
    probableCauses: evidence.length > 0 ? [{ cause: `Relevant details were found in fallback knowledge.`, confidence: 'high', evidenceIds: [evidence[0].chunkId] }] : [],
    recommendedActions: evidence.length > 0 ? ['Review the matched document evidence before using live production data.'] : [],
    riskNote: 'Fallback response is grounded in local knowledge only.',
    sources,
    confidence: { level: evidence.length > 0 ? 'high' : 'low', score: evidence.length > 0 ? 86 : 48, basis: 'Local knowledge fallback' },
    fallback: true,
  };

  const memoryEntry: EpisodicMemoryRecord = {
    id: `fallback-memory-${Date.now()}`,
    execution_id: `exec-${Date.now()}`,
    task_id: null,
    organization_id: 'org-1',
    query,
    agents_used: ['fallbackRetrieval', 'fallbackAnswerBuilder'],
    retrieved_evidence: sources,
    final_output: answer,
    success: evidence.length > 0,
    confidence: answer.confidence.score,
    latency_ms: 20,
    created_at: new Date().toISOString(),
  };
  episodicMemory.unshift(memoryEntry);
  if (episodicMemory.length > 50) episodicMemory.pop();

  return Promise.resolve({ answer, sources, fallback: true });
}

export async function fallbackRagSearch(query: string) {
  const ranked = rankFallbackChunks(chunks as DocChunk[], query);
  return Promise.resolve({
    query,
    rewrittenQueries: [query],
    embeddingCreated: false,
    embeddingModel: 'Local Knowledge Retrieval',
    warnings: ['Fallback retrieval: no live embeddings or pgvector similarity call was made.'],
    vectorResults: ranked,
    lexicalResults: ranked,
    metadataResults: ranked.map((row) => ({ ...row, metadataScore: row.metadataScore })),
    graphResults: ranked.map((row) => ({ ...row, graphScore: row.graphScore })),
    fusionResults: ranked,
    finalResults: ranked,
  } as RetrievalDebug);
}
