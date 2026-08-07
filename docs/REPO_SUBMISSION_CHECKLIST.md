# Repository Submission Checklist

Use this checklist to confirm the repository is clean, coherent, and ready for final hackathon submission.

## Repository structure

- [x] Project files at repository root (moved from nested `AgentOS-Intelligence/`)
- [x] No nested `AgentOS-Intelligence/` project directory remains
- [x] `supabase/.temp/` removed from tracking and ignored
- [x] `.gitignore` covers `node_modules/`, `dist/`, `.env`, `supabase/.temp/`, `.DS_Store`, `coverage/`, `*.log`
- [x] Internal editor/AI tooling config (`.bolt/`) removed from tracking and ignored
- [x] `AGENTS.md` (internal Codex instructions) moved out of the product root to `reference/`
- [x] `.env.example` is tracked (not ignored)

## README & narrative

- [x] README rewritten for AgentOS Intelligence
- [x] Current problem statement visible
- [x] Current solution clearly explained
- [x] Novelty clearly explained (shared evidence state, hybrid retrieval, KG + RAG, traceability, shared memory)
- [x] Hybrid RAG architecture shown (Mermaid diagram)
- [x] Implemented vs planned clearly separated
- [x] Tech stack is accurate (no invented libraries)
- [x] No legacy ET AI Hackathon / ForgeMind-as-current framing
- [x] Legacy ForgeMind content archived in `docs/LEGACY_FORGEMIND.md`

## GitHub metadata

- [x] `docs/GITHUB_METADATA.md` created (description, topics, demo URL placeholder)
- [ ] Demo URL added to GitHub About if a live deployment exists (currently `TODO`)
- [x] Topics documented

## Media

- [ ] `docs/assets/dashboard.png` added
- [ ] `docs/assets/ingestion.png` added
- [ ] `docs/assets/rag-search.png` added
- [ ] `docs/assets/knowledge-graph.png` added
- [ ] `docs/assets/retrieval-debug.png` added
- [ ] `docs/assets/demo.gif` added (optional)
- [x] `docs/SCREENSHOT_CHECKLIST.md` created
- [x] README screenshots section is a commented placeholder (no broken image links)

## Validation

- [x] `npm install` completes
- [x] `npm run build` passes
- [x] `npx tsc --noEmit` passes
- [x] `npm run lint` passes (0 errors; 5 pre-existing fast-refresh warnings)
- [x] Imports still resolve after directory move (build/typecheck confirm)
- [x] Supabase edge-function/migration paths are correct
- [x] No real secrets committed (scan found only environment-variable references)
- [x] No `supabase/.temp` files tracked

## Git

- [x] Commit 1: `chore: restructure AgentOS Intelligence repository`
- [x] Commit 2: `docs: rewrite hackathon README and architecture`
