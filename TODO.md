# TODO — Bounty Task 1: Structured API Validation Layer

## Phase 1 — Inspect
- [x] Read repository, identify endpoints, edge functions, services, agent/RAG/document/graph/memory endpoints

## Phase 2 — Validation Architecture (frontend)
- [x] Create `src/shared/validation/` structure
- [x] `errorCodes.ts` — ApiErrorCode enum + HTTP status mapping
- [x] `requestId.ts` — UUID request IDs
- [x] `apiResponse.ts` — success/error envelopes + helpers (ok, created, badRequest, validationError, notFound, internalError)
- [x] `logger.ts` — request-scoped logging hooks (no secrets)
- [x] `validator.ts` — typed parse helpers
- [x] `schemas/requestSchemas.ts` — Zod request schemas + inferred types
- [x] `schemas/responseSchemas.ts` — Zod response schemas
- [x] `errorUtils.ts` — frontend error categorization (Loading/Success/Validation/Server/Network/Unknown)
- [x] `index.ts` — re-exports

## Phase 2b — Validation Architecture (Edge Functions)
- [x] Create `supabase/functions/_shared/validation/`
- [x] `errorCodes.ts`, `httpStatus.ts`, `requestId.ts`, `apiResponse.ts`, `logger.ts`, `schemas.ts`, `middleware.ts`, `index.ts`

## Phase 4 — Standard API Response
- [x] Consistent success/failure envelope types defined

## Phase 5 — Request IDs
- [x] Generate requestId for every request, attach to request/logs/response/errors

## Phase 6 — Standard Error Codes
- [x] Enum with all required codes

## Phase 7 — HTTP Status Mapping
- [x] 200/201/400/401/403/404/409/413/415/422/429/500

## Phase 8 — Validation Middleware
- [x] validateRequest(schema), validateResponse(schema), handleErrors()

## Phase 9 — Apply Validation Everywhere
- [x] Integrate into forge-ai edge function
- [x] Integrate into rag-ingest edge function
- [x] Integrate into src/lib/api.ts (typed models, response validation, request IDs)
- [x] Integrate into Copilot, RagSearch, Documents, Drawings, Memory, Settings pages
- [x] Integrate into Alerts, Compliance, AssetDetail, Maintenance, DocumentDetail, KnowledgeGraph, QMS pages

## Phase 10 — Frontend Error Handling
- [x] Reusable error utilities producing friendly messages

## Phase 11 — Error UI
- [x] `src/components/ErrorCard.tsx` (title, description, request ID, retry, expandable details)

## Phase 12 — Logging Hooks
- [x] Log requestId, endpoint, user, org, timestamp, validation errors, latency; no secrets

## Phase 13 — Developer Utilities
- [x] ok/created/badRequest/validationError/notFound/internalError helpers

## Phase 14 — Testing
- [ ] Install vitest
- [x] Tests: invalid upload, missing query, invalid UUID, large payload, unsupported file, bad graph request, malformed agent request, response validation
- [ ] Verify each test checks HTTP status, response schema, error code

## Phase 15 — Documentation
- [x] `docs/API_VALIDATION.md`

## Phase 16 — README
- [x] Add Structured API Validation Layer section

## Phase 18 — Completion
- [x] `API_VALIDATION_COMPLETION.md` with validation coverage table
- [ ] Run `npm run build`, `npm run lint`, `npx tsc --noEmit`, fix all errors
