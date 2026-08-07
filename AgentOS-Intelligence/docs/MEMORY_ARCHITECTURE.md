# Shared Organizational Memory

Phase 1 separates memory by purpose:

- **Working memory** (`working_memory`): an expiring task record with original/rewritten queries, plan, evidence chunk IDs, discovered entities, debug payload, and intermediate answer.
- **Episodic memory** (`episodic_memory`): durable query execution history including agents actually used, retrieved citations, final output, evidence-derived confidence, latency, and debug payload.
- **Semantic memory**: versioned documents, semantic chunks, real embeddings, full-text vectors, and metadata.
- **Graph memory**: normalized entities, aliases, evidence-backed relationships, and entity mentions.

`forge-ai` writes working memory before completion and episodic memory after the retrieval/answer run. Future agents should use the `hybridRetrieve`/`forge-ai` knowledge path instead of making unscoped table queries.

Generated text is never promoted into semantic or graph memory. Only uploaded source material and evidence-traceable extraction writes are persisted.
