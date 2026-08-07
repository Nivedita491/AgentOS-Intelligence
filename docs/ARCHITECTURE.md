# ForgeMind AI — Architecture

> Phase 1 update: the sections below preserve the original ForgeMind architecture and industrial domain context. For the current organizational RAG path, use `RAG_ARCHITECTURE.md`, `INGESTION_PIPELINE.md`, `KNOWLEDGE_GRAPH.md`, `MEMORY_ARCHITECTURE.md`, and `DATABASE_SCHEMA.md`. References below to keyword vector search or browser-only parsing are historical, not current behavior.

## System Overview

ForgeMind AI is an industrial knowledge intelligence platform that unifies fragmented operational documents into a queryable, evidence-backed operations intelligence system. It combines document intelligence, asset intelligence, retrieval-augmented generation (RAG), root-cause analysis, compliance intelligence, and knowledge graph visualisation.

## Component Architecture

### Frontend (React + TypeScript + Vite)

- **App Shell** — persistent sidebar (desktop) + drawer (mobile), compact top bar with global search, system status, and avatar placeholder
- **Routing** — React Router with 10 primary routes
- **Pages** — Dashboard, Assets List, Asset 360, Documents, Document Detail, AI Copilot, Maintenance Intelligence, Compliance Intelligence, Knowledge Graph, Alerts, Settings
- **Shared Components** — StatusBadge, MetricCard, PageHeader, Card, EmptyState, ErrorState, LoadingRow, MiniGraph
- **Design System** — Tailwind CSS with semantic status colours, 8px spacing rhythm, restrained enterprise aesthetic

### Backend (Supabase Edge Functions)

- **forge-ai** — single edge function handling AI queries
  - Query classification (intent detection)
  - Asset tag extraction
  - Document retrieval from Supabase
  - Gemini API call with timeout and retry
  - JSON response parsing and validation
  - Deterministic fallback answers grounded in seeded evidence
  - CORS headers on all responses

### Database (PostgreSQL / Supabase)

13 tables with foreign-key relationships, indexes, and RLS policies. See schema migration for full details.

## Industrial Ontology

Entities are mapped to ontology classes:

Asset, Equipment, Component, Subsystem, MaintenanceActivity, Inspection, Incident, FailureMode, Symptom, CorrectiveAction, PreventiveAction, SafetyProcedure, OperatingProcedure, QualityRecord, Deviation, CAPA, NCR, Audit, Technician, Department, Location, Document, Procedure, ComplianceRequirement, Risk, Drawing.

### Typed Relationships

HAS_COMPONENT, LOCATED_IN, MENTIONED_IN, FAILED_AS, GENERATED_INCIDENT, INSPECTED_BY, HAS_SOP, REQUIRES_ACTION, RELATED_TO, SIMILAR_FAILURE, REFERENCES_DOCUMENT, HAS_QMS_RECORD, EVIDENCED_BY, ASSOCIATED_WITH, SIMILAR_TO, EXPERIENCED_FAILURE, INSPECTED_IN, GOVERNED_BY.

The ontology powers:
- Knowledge Graph visualisation
- Hybrid retrieval (graph traversal as a retrieval source)
- Asset Intelligence (component hierarchy, failure modes)
- Agent reasoning (relationship-aware evidence)

## Quality Management System (QMS)

QMS records are stored in `qms_records` with types:
Deviation, CAPA, NCR, AuditFinding, CorrectiveAction, PreventiveAction, TrainingRecord, QualityEvent, BatchInvestigation.

Records are linked to assets, documents, incidents, and maintenance events. They appear in:
- QMS page (`/qms`) with tabbed view by record type
- Asset 360 Quality tab
- AI Copilot answers (qmsFindings in response schema)
- Knowledge graph (HAS_QMS_RECORD relationships)

## Vision Agent

Engineering drawings are stored in `engineering_drawings` with:
- OCR text extraction
- Detected equipment tags (regex: `\b([A-Z]{1,3}-\d{2,3})\b`)
- Detected instrument tags (FT, TT, PI, LT, TIC, SV, etc.)
- Detected labels (location, equipment names)
- Extracted entities inserted into ontology
- Linked to existing assets

If Gemini Vision is available, it would be used for image-based extraction. Currently uses deterministic OCR-based extraction from text content.

## Document Ingestion Pipeline (Enhanced)

```
Upload → OCR → Layout Detection → Table Extraction → Entity Extraction → Document Classification → Ontology Mapping → Knowledge Graph Update → Chunking → Hybrid Index → Ready
```

If OCR fails, continues using available parsed text.

## Query Processing Flow (Hybrid Industrial Retrieval Engine)

```
User Query
→ Intent Classification
→ Asset Detection
→ Hybrid Retrieval
  ├── Semantic Vector Search (keyword-based chunk matching)
  ├── Metadata Filtering (asset-linked documents, type/department)
  └── Knowledge Graph Traversal (ontology relationship edges)
→ Evidence Aggregation (dedup, rank, conflict removal)
→ Grounded Gemini Response
→ Citation Validation
→ Final Answer
```

### Multi-Agent Architecture

The edge function implements coordinated multi-agent orchestration:

| Agent | Responsibility |
|-------|---------------|
| Orchestrator | Query routing, intent classification, coordination |
| Knowledge Agent | Document & vector retrieval |
| Maintenance Agent | Maintenance history & failure retrieval |
| Compliance Agent | Compliance & inspection retrieval |
| Quality Agent | QMS records retrieval |
| Knowledge Graph Agent | Ontology relationship traversal |
| Vision Agent | Engineering drawing reference retrieval |

### Evidence Aggregator

Merges evidence from all agents:
- Deduplicates sources across retrieval methods
- Ranks by relevance (asset match, keyword match, relationship proximity)
- Removes conflicting evidence
- Forwards only validated evidence to Gemini
- Gemini never directly retrieves raw database records

### Intents

- `root_cause_analysis` — why is X happening?
- `compliance_query` — what inspections are overdue?
- `similar_incident_search` — show previous failures similar to X
- `maintenance_history` — summarise maintenance events
- `document_search` — what does the manual recommend?
- `quality_query` — what QMS records exist?
- `drawing_query` — what drawings reference this asset?
- `general_operational_question` — fallback

### Retrieval Logic (Hybrid)

1. **Vector retrieval** — keyword-based search across `document_chunks` table using ILIKE patterns
2. **Metadata retrieval** — filter `documents` by `linked_asset_id` for asset-specific queries
3. **Knowledge graph retrieval** — traverse `entity_relationships` from asset entity to related entities
4. Merge and deduplicate across all three methods
5. Rank by asset match, keyword match, document type relevance

### Answer Schema

```json
{
  "directAnswer": "",
  "keyFindings": [{ "finding": "", "evidenceIds": [] }],
  "probableCauses": [{ "cause": "", "confidence": "high|medium|low", "evidenceIds": [] }],
  "recommendedActions": [],
  "riskNote": "",
  "sources": [{ "documentId": "", "documentName": "", "page": null, "section": "", "excerpt": "" }],
  "confidence": { "level": "high|medium|low", "score": 0, "basis": "" }
}
```

### Citation Validation

- Source references validated against retrieved documents
- Document IDs attached from real database records
- Confidence downgraded when evidence is incomplete
- "Evidence insufficient" returned when no matching evidence

## Database Model

### Core Tables

| Table | Purpose |
|-------|---------|
| `assets` | Industrial equipment (12 seeded) |
| `documents` | Uploaded documents (10 seeded) |
| `document_chunks` | Text chunks for retrieval |
| `entities` | Extracted entities with ontology_class (89 seeded) |
| `entity_relationships` | Typed graph edges (70 seeded) |
| `maintenance_events` | Maintenance history per asset |
| `incidents` | Failure/incident records |
| `inspections` | Inspection records |
| `compliance_rules` | Deterministic inspection rules (8 seeded) |
| `compliance_findings` | Computed compliance status per asset+rule |
| `alerts` | Operational alerts (6 seeded) |
| `ai_queries` | Logged AI copilot queries |
| `recommended_actions` | Actions derived from AI analysis |
| `qms_records` | QMS records — deviations, CAPA, NCR, audits (8 seeded) |
| `engineering_drawings` | Vision Agent processed drawings (3 seeded) |
| `app_settings` | Key-value settings |

### Security

- RLS enabled on all tables
- Policies allow `anon, authenticated` CRUD (single-tenant demo, no auth)
- `auth.uid()` not used (no auth by design)

## Compliance Engine

Deterministic, rule-based. Date calculations are computed in SQL and client-side — never delegated to the LLM.

```
daysSinceLastEvidence = currentDate - lastEvidenceDate
dueDate = lastEvidenceDate + intervalDays

if no evidence: status = MISSING_EVIDENCE
else if currentDate > dueDate: status = OVERDUE, daysOverdue = currentDate - dueDate
else if dueDate within 15 days: status = DUE_SOON
else: status = COMPLIANT
```

Rules:
1. Pump lubrication inspection every 30 days
2. Boiler safety inspection every 90 days
3. Pressure vessel inspection every 180 days
4. Emergency shutdown test every 90 days
5. Critical rotating asset vibration inspection every 30 days
6. Calibration certificate validity 365 days
7. Permit evidence required for high-risk maintenance
8. Inspection evidence required before closing corrective action

The LLM is used only to *explain* rule-based results, never to compute them or invent regulations.

## Knowledge Graph

- Built from `entities` and `entity_relationships` tables
- Entity types: Asset, Document, Manual, SOP, Failure, Inspection, Maintenance Event, Corrective Action, Location
- Relationship types: HAS_MANUAL, GOVERNED_BY, EXPERIENCED_FAILURE, INSPECTED_IN, LOCATED_IN, REQUIRES_ACTION, SIMILAR_TO, EVIDENCED_BY, MENTIONS, ASSOCIATED_WITH
- React Flow with radial layout around focused asset
- Default focus: Pump P-204
- Filter by entity type, search, click node to inspect, evidence links

## Gemini Integration

- Server-side only (edge function)
- `GEMINI_API_KEY` environment variable
- Central AI service in edge function: classifyQuery, extractDocumentMetadata, extractEntities, generateGroundedAnswer
- Request timeout (25s), retry once, JSON parsing validation
- Fallback output when Gemini fails
- Logging without exposing secrets

### Fallback Strategy

When Gemini is unavailable:
- Document search works (lexical + metadata retrieval)
- Compliance calculations work (deterministic)
- Demo queries return deterministic fallback answers
- Fallback answers are clearly labelled

## Deployment Architecture

```
Browser → Vite dev server (frontend)
       → Supabase Postgres (database)
       → Supabase Edge Functions (forge-ai)
       → Google Gemini API (optional)
```

## Security Boundaries

- Gemini API key: server-side only (edge function env var)
- Supabase keys: anon key in frontend, service role key in edge function only
- File upload: extension validation, size limit, filename sanitisation
- RLS: enabled on all tables, anon+authenticated access for single-tenant demo
- No server file-system paths exposed to clients

## Scalability Roadmap

- Server-side document parsing (pdf-parse, mammoth, xlsx)
- Gemini embeddings for semantic retrieval
- Vector index (pgvector) for embedding-based search
- Multi-tenant with authentication and per-tenant RLS
- Real-time alert ingestion from SCADA/IIoT
- Predictive maintenance models with validated accuracy
- External regulation corpus integration
- Horizontal scaling of edge functions
