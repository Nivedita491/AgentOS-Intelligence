# API Validation

This project uses a structured API validation layer with Zod schemas for both frontend and Supabase Edge Function request/response handling.

## Coverage

- `src/shared/validation/schemas/requestSchemas.ts`
  - Request schemas for hybrid retrieval, document upload, graph search, memory search, agent execution, job creation, history queries, user actions, Copilot queries, settings.
- `src/shared/validation/schemas/responseSchemas.ts`
  - Standard success/error response envelopes.
  - Typed response validation for document creation, document actions, and Forge AI responses.
- `src/shared/validation/validator.ts`
  - Typed request parsing and standardized ApiError mapping.
- `src/lib/api.ts`
  - `assertRequest()` used for outgoing edge requests.
  - `invokeEdge()` validates edge responses.
  - `uploadDocument()`, `reindexDocument()`, `deleteDocument()`, `copilotQuery()`, `ragSearch()` all validate payloads.
- `supabase/functions/_shared/validation/`
  - Edge Function request/response validation, request IDs, error codes, status mapping, logging.
- `supabase/functions/forge-ai/index.ts`
  - `validateRequest()` against `ForgeAIRequestSchema`.
- `supabase/functions/rag-ingest/index.ts`
  - `validateRequest()` for create/process/reindex/delete actions.

## Error model

All API failures use a standardized envelope:

```json
{
  "success": false,
  "requestId": "...",
  "code": "VALIDATION_ERROR",
  "message": "...",
  "details": [...],
  "timestamp": "..."
}
```

All success responses use:

```json
{
  "success": true,
  "requestId": "...",
  "data": { ... },
  "meta": { ... }
}
```

## Frontend error handling

- `src/shared/validation/errorUtils.ts`
- `src/components/ErrorCard.tsx`
- `src/components/ui-primitives.tsx` contains `ErrorState` and `LoadingCard`.

## Validation tests

- `src/shared/validation/validation.test.ts`
  - Request parsing for invalid upload, missing query, invalid UUID, large payload, bad graph request, malformed agent request.
  - Response validation for standardized success/error envelopes and Forge AI payloads.
