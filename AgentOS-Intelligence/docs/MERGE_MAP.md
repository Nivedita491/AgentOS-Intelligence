# Merge Map

## ForgeMind retained as foundation
- `src/pages/Documents.tsx`, `DocumentDetail.tsx`: document UI
- `src/pages/Copilot.tsx`: existing AI/RAG interaction surface
- `src/pages/KnowledgeGraph.tsx`: graph UI
- `src/lib/api.ts`: document/data access and current ingestion/chunking logic (must be upgraded)
- `src/lib/supabase.ts`: Supabase client
- `supabase/migrations/*`: current database foundation
- `supabase/functions/forge-ai/index.ts`: current AI edge-function foundation
- shared UI components and app shell

## AgentOS selected for adaptation
Stored under `reference/agentos/`:
- `backend/engine.ts`: agent registry, workflow DAG, selection/recovery concepts
- `backend/server.ts`: mission API shape/reference
- workflow visualizer pages/nodes
- Agent Store page
- Command Center page
- New Mission page
- Mission Report page
- mission API client
- supporting UI components/types

## Deliberately not copied
- `node_modules/`
- `dist/`
- nested `.git/` histories
- `.env` files/secrets
- AgentOS landing/assets not required for integration

## Do not merge blindly
The projects use incompatible React/router/dependency versions. Port behavior and presentation into the ForgeMind dependency stack rather than replacing root package versions with AgentOS versions.
