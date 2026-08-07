# Knowledge Graph

The graph is not a demo-only visualization. `entities`, `entity_mentions`, and `entity_relationships` are evidence-backed organizational memory.

During ingestion, Gemini receives small source-chunk batches and returns validated JSON constrained to supported entity and relationship types. Entity names are normalized before upsert; aliases preserve surface forms. Every mention is tied to one chunk. Every generated relationship stores its source document, source chunk, evidence excerpt, and confidence score.

If structured extraction cannot run because Gemini is unavailable, the ingestion pipeline records a warning and only creates deterministic, source-backed asset-tag mentions. It does not create random graph data.

Graph retrieval first matches query terms to normalized entities, then walks one or two relationship hops using `match_graph_document_chunks`. It returns chunks through their `entity_mentions`, with a traversal explanation. The Knowledge Graph page reads these database records, lets users filter entity/relationship types, inspect chunk evidence, and expand connected neighbors.
