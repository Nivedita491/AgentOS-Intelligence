# Database Schema — Phase 1

Migration `20260807000100_phase1_organizational_rag.sql` adds the `vector` extension, a default organization, membership foundation, organization IDs, scoped RLS, private document storage policies, and these principal additions:

| Area | Tables / fields |
|---|---|
| Semantic retrieval | `document_chunks.embedding vector(768)`, `search_vector`, content hash, chunk lineage/metadata, HNSW + GIN indexes |
| Embedding cache | `embedding_cache` keyed by organization, content hash, and model |
| Document lineage | storage path, processing stage/error, version/effective dates/current flag, permission-preparation fields |
| Graph | entity aliases/canonical name/confidence and `entity_mentions`; relationship chunk evidence and numeric confidence |
| Shared memory | `working_memory`, `episodic_memory` |
| Retrieval API | `match_document_chunks`, `match_document_chunks_lexical`, `match_metadata_document_chunks`, `match_graph_document_chunks` |

Anonymous demo access is constrained to the seeded `default` organization. Authenticated users are prepared for `organization_members`-based access. Edge functions use the service role but still explicitly scope every organization query to the default demo tenant. A production multi-tenant deployment must issue authenticated upload URLs and map real users to memberships before accepting non-default organizations.
