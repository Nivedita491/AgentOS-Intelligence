export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

export const RETRIEVAL_DEFAULTS = {
  vectorCandidates: 20,
  lexicalCandidates: 20,
  metadataCandidates: 20,
  graphCandidates: 10,
  fusionCandidates: 25,
  finalEvidence: 8,
  rrfK: 60,
  maxGraphHops: 2,
  semanticThreshold: 0.15,
  fusionWeights: {
    semantic: 0.5,
    lexical: 0.2,
    graph: 0.15,
    metadata: 0.1,
    recency: 0.05,
  },
} as const;

export interface RetrievalFilters {
  organizationId: string;
  documentIds?: string[];
  sourceTypes?: string[];
  department?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  metadata?: Record<string, unknown>;
  entityIds?: string[];
}

export interface RetrievalCandidate {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  metadata: Record<string, unknown>;
  pageNumber: number | null;
  sectionTitle: string | null;
  headingPath: string[];
  sourceType: string | null;
  semanticScore?: number;
  lexicalScore?: number;
  graphScore?: number;
  metadataScore?: number;
  recencyScore?: number;
  fusedScore?: number;
  rerankScore?: number;
  retrievalRanks: Partial<Record<"semantic" | "lexical" | "metadata" | "graph", number>>;
  traversal?: string[];
}

export interface Citation {
  documentId: string;
  documentName: string;
  chunkId: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  similarityScore: number | null;
  sourceType: string | null;
}

export interface RetrievalDebug {
  query: string;
  rewrittenQueries: string[];
  filters: RetrievalFilters;
  embeddingCreated: boolean;
  embeddingModel: string;
  warnings: string[];
  vectorResults: RetrievalCandidate[];
  lexicalResults: RetrievalCandidate[];
  metadataResults: RetrievalCandidate[];
  graphResults: RetrievalCandidate[];
  fusionResults: RetrievalCandidate[];
  finalResults: RetrievalCandidate[];
}

export interface HybridRetrievalResult {
  evidence: RetrievalCandidate[];
  citations: Citation[];
  debug: RetrievalDebug;
  discoveredEntities: string[];
}

export interface ParsedBlock {
  text: string;
  pageNumber?: number | null;
  headingPath?: string[];
  sectionTitle?: string | null;
  kind?: "paragraph" | "table" | "list" | "code";
}

export interface ParsedDocument {
  text: string;
  blocks: ParsedBlock[];
  pageCount: number | null;
  metadata: Record<string, unknown>;
}

export interface SemanticChunk {
  content: string;
  contentHash: string;
  chunkIndex: number;
  pageNumber: number | null;
  sectionTitle: string | null;
  headingPath: string[];
  sourceType: string;
  mimeType: string;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
  metadata: Record<string, unknown>;
}

export const ENTITY_TYPES = new Set([
  "Organization", "Product", "Employee", "Client", "Technology", "Document",
  "Meeting", "Policy", "Campaign", "Project", "Team", "Department", "Decision",
  "Person", "Location", "Asset", "Component", "Procedure", "QualityRecord",
]);

export const RELATIONSHIP_TYPES = new Set([
  "MEMBER_OF", "WORKS_ON", "OWNS", "CREATED_BY", "MENTIONS", "REFERENCES", "USES",
  "DEPENDS_ON", "TARGETS", "RELATED_TO", "DISCUSSED_IN", "DECIDED_IN", "PART_OF",
  "AFFECTS", "SUPERSEDES", "REPLACES", "APPROVED_BY", "ASSIGNED_TO", "EVIDENCED_BY",
]);
