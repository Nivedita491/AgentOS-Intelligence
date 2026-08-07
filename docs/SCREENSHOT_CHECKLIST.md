# Screenshot Checklist

The README references a `docs/assets/` directory for screenshots and a demo GIF. None of these files exist yet, so the README intentionally uses **commented placeholders** rather than broken image links. Add the screenshots below, then uncomment the corresponding README image markup.

## Required screenshots

1. **Command / Dashboard view** — `docs/assets/dashboard.png`
   - The main Command Center showing organizational overview, connected module cards, and status.

2. **Document ingestion status** — `docs/assets/ingestion.png`
   - The Documents page showing a fixture uploading through the pipeline stages:
     `Uploaded → Extracting → Chunking → Embedding → Graph Building → Ready`.

3. **RAG answer with citation** — `docs/assets/rag-search.png`
   - A RAG Search result showing a grounded answer, retrieved evidence chunks, and chunk-level source citations.

4. **Knowledge graph visualization** — `docs/assets/knowledge-graph.png`
   - The Knowledge Graph page showing entities, typed relationships, and evidence-backed entity/relationship data.

5. **Retrieval debug panel** — `docs/assets/retrieval-debug.png`
   - The RAG Search debug view showing vector, lexical, metadata, graph results, RRF fusion, and reranking scores.

6. **Optional short GIF** — `docs/assets/demo.gif`
   - A short loop of: upload a document → query → see the knowledge graph → view a cited answer.

## Naming conventions

- Use lowercase hyphenated filenames as listed above.
- Place all files flat inside `docs/assets/`.
- Keep screenshots under ~1 MB each where possible; keep the GIF under ~5 MB.

## How to reference in the README

The README contains a commented block such as:

```md
<!--
## Screenshots

![Command Center](docs/assets/dashboard.png)
![RAG Search](docs/assets/rag-search.png)
![Knowledge Graph](docs/assets/knowledge-graph.png)

![Demo](docs/assets/demo.gif)
-->
```

Once the files are added, delete the surrounding `<!--` and `-->` comment markers to render the images.
