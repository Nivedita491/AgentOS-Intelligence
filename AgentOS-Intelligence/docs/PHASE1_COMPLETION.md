# Phase 1 Completion

## Implemented

- Real 768-dimension Gemini embedding service with batching, retry, provider errors, and content-hash cache.
- `pgvector` HNSW semantic search; PostgreSQL full-text lexical retrieval; metadata retrieval; graph retrieval; weighted RRF; reranking; score/debug preservation; citation lineage.
- Storage-backed, server-side ingestion with actual PDF/image Gemini extraction and DOCX/PPTX/XLSX/CSV/TXT/Markdown parsers.
- Structure-aware semantic chunks, table representation, normalized graph extraction, evidence-linked entities/relationships, delete/reindex, document status polling, shared working/episodic memory, and organization-scoped database foundation.
- RAG Search, Memory, upgraded Documents/Document Detail, and evidence-aware Knowledge Graph UI.
- Fixture documents plus 15 source-expected RAG queries in `fixtures/phase1-demo`.

## Files added / materially changed

- `supabase/migrations/20260807000100_phase1_organizational_rag.sql`
- `supabase/functions/rag-ingest/index.ts`
- `supabase/functions/forge-ai/index.ts`
- `supabase/functions/_shared/rag/*`
- `src/lib/api.ts`, `src/types/index.ts`, Documents, Document Detail, Knowledge Graph, sidebar/routes, `RagSearch`, and `Memory` pages.

## Run

1. `npm install`
2. Apply migrations: `supabase db push` (or apply the migration in the Supabase SQL editor).
3. Set Edge Function secrets: `supabase secrets set GEMINI_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=...`.
4. Deploy: `supabase functions deploy rag-ingest` and `supabase functions deploy forge-ai`.
5. Copy `.env.example` to `.env` and supply only Vite-safe Supabase variables.
6. `npm run typecheck && npm run lint && npm run build`
7. `npm run dev`

## Validate

Upload a fixture through Documents and watch `Extracting → Chunking → Embedding → Graph Building → Ready`. Then use RAG Search for a semantic paraphrase, a keyword-heavy query, and a relationship query. Inspect vector/lexical/graph scores and citations; open Memory to confirm the working and episodic records; use Document Detail to reindex or delete.

## Verification performed (2026-08-07)

- `npm install` completed.
- `npm run typecheck` passed.
- `npm run lint` completed with 0 errors and 5 existing React fast-refresh warnings in shared UI primitives.
- `npm run build` passed; Vite produced the production bundle. (The sandbox needed elevated filesystem access for esbuild to read `vite.config.ts`.)
- The Vite dev server started outside the sandbox and returned HTTP 200 from `http://127.0.0.1:4174/`.
- The in-app browser surface and the local Deno/Supabase CLIs are unavailable in this workspace, so no visual browser test, migration application, Edge Function deployment, or live Gemini/Supabase ingestion test was run.

## External prerequisites / limitations

Live PDF/image extraction, embeddings, structured graph extraction, and semantic-query validation require a configured Gemini key. Applying migrations and deploying Edge Functions require a Supabase project/CLI. In their absence, source changes can be type/lint/build tested, but the live end-to-end checks cannot be truthfully completed. The current browser demo remains intentionally scoped to the seeded default organization until real authentication/membership provisioning is enabled.
