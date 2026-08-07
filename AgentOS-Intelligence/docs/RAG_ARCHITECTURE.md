# Phase 1 RAG Architecture

ForgeMind now uses a server-side hybrid retrieval pipeline. The browser never creates embeddings or receives provider secrets.

```text
query → query analysis / bounded rewrite
      → Gemini query embedding → pgvector cosine candidates
      → PostgreSQL FTS lexical candidates
      → metadata-filtered candidates
      → graph entity match + bounded 1–2 hop traversal
      → weighted reciprocal-rank fusion → heuristic rerank
      → duplicate removal → cited final context
      → grounded Gemini answer (or evidence-only response)
      → working + episodic memory record
```

`gemini-embedding-001` is configured at 768 dimensions. The dimension is explicit in migration `20260807000100_phase1_organizational_rag.sql`; changing model or dimensionality needs a new vector column/index and full reindex.

Vector retrieval uses `match_document_chunks`; lexical retrieval uses `match_document_chunks_lexical` and `ts_rank_cd` over a generated `tsvector`; metadata retrieval uses `match_metadata_document_chunks`; graph retrieval uses `match_graph_document_chunks` over `entity_mentions` and evidence edges. No semantic path uses `ILIKE`.

Fusion uses weighted Reciprocal Rank Fusion with tunable defaults in `supabase/functions/_shared/rag/types.ts`. Small normalized component boosts retain raw semantic, lexical, graph, and metadata scores for debugging. Reranking uses query-term coverage, exact phrase match, heading match, and fused rank; it is a transparent heuristic fallback rather than a claim of cross-encoder quality.

The `/rag-search` page exposes the embedding state, every retriever, RRF results, reranking, final context, and individual scores.
