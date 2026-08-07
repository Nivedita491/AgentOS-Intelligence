# AgentOS Intelligence — Codex Instructions

## Goal
Turn this repository into a hackathon-grade collaborative organizational RAG system with a Social Media Agent.

## Source of truth
- The runnable application foundation is the existing ForgeMind code in `src/`, `supabase/`, and root config files.
- Selected AgentOS source files are preserved under `reference/agentos/` for porting ideas/components. They are NOT compiled and should not be imported wholesale.
- New integration scaffolds live under `src/features/`.

## Product architecture
1. User submits an organizational task.
2. Orchestrator decomposes/routs it.
3. RAG Agent retrieves shared evidence.
4. Specialized agents collaborate through a shared TaskContext / structured messages.
5. Social Media Agent creates platform-specific content when requested.
6. Verifier checks factual claims against retrieved evidence.
7. Unsupported claims trigger revision/re-retrieval.
8. Only verified knowledge may be promoted into permanent organizational memory.
9. Human approval is required before external social posting.

## Highest-priority engineering tasks
1. Replace keyword-only retrieval with real vector embeddings + pgvector semantic search.
2. Implement server-side PDF/DOCX/XLSX text extraction; browser `file.text()` is not sufficient for binary documents.
3. Replace fixed 1200-character chunking with token/structure-aware chunks and overlap.
4. Preserve page/section/source metadata so citations are defensible.
5. Generalize industrial-only metadata into organizational entities while keeping industrial demo data compatible.
6. Build KnowledgeService as the only shared retrieval interface for agents.
7. Implement Orchestrator -> RAG -> Research -> Social -> Verifier real workflow.
8. Port/adapt AgentOS workflow visualizer and agent-store UX from `reference/agentos/` to the current React/router versions.
9. Add agent execution/message persistence and verified-memory candidate workflow.
10. Add a real evaluation dataset/dashboard; never fake accuracy metrics.

## Important current limitations
- Existing ForgeMind chunk retrieval is lexical/keyword based, despite some vector-style wording.
- `embedding_json`/related schema fields do not constitute vector search by themselves.
- Existing binary document parsing is a placeholder.
- AgentOS reference execution contains simulated/deterministic workflow behavior; do not present it as real model execution.
- Agent provider/model labels in the legacy registry are metadata until real adapters invoke those providers.

## Implementation rules
- Keep this a modular monolith for the hackathon; do not split into unnecessary microservices.
- Keep provider logic behind adapters so models are swappable.
- Keep evidence IDs/citations attached to all agent outputs.
- Never store unverified generated facts directly into permanent memory.
- Preserve tenant/role/access filters in retrieval design.
- Avoid exposing provider API keys in Vite/client code.

## Desired demo
Prompt: "We are launching AgentOS next week. Create a LinkedIn announcement targeted at CTOs using the latest approved pricing and product capabilities. Do not make unsupported claims."
Show: orchestration plan -> retrieved chunks -> graph context -> research synthesis -> social draft -> claim verification -> citations -> human approval.
Then change only the target platform to Instagram to demonstrate reuse of shared organizational memory.

## Phase 1 RAG implementation
- The production-style knowledge path is now `rag-ingest` → `document_chunks.embedding`/FTS/graph → `forge-ai`; do not add browser-side parsing, embeddings, or `ILIKE` semantic retrieval back into it.
- Gemini `gemini-embedding-001` uses a 768-dimension vector column. A model/dimension change needs a migration and reindex; never insert synthetic vector values.
- Preserve `organization_id` filters and use the retrieval RPCs or `hybridRetrieve`, not unscoped table reads, for new agent knowledge access.
- Graph entities and edges need document/chunk evidence. Generated summaries remain episodic output and must not be inserted as permanent semantic knowledge.
- See `docs/RAG_ARCHITECTURE.md`, `docs/INGESTION_PIPELINE.md`, `docs/KNOWLEDGE_GRAPH.md`, `docs/MEMORY_ARCHITECTURE.md`, and `docs/DATABASE_SCHEMA.md` before extending this layer.
