# Ingestion Pipeline

`rag-ingest` is a Supabase Edge Function. The browser uploads an object to the private `organizational-documents` bucket, creates a document record, then polls the real processing status while the function performs:

```text
Uploaded → Extracting → Chunking → Embedding → Graph Building → Ready
```

Failures set the document to `Failed` with a safe stage/message payload and retain the source object for retry/reindex.

Supported parsers:

- PDF: Gemini document extraction preserves returned page, heading, and table data.
- DOCX/PPTX/XLSX: pure-JavaScript ZIP/XML extraction in the edge runtime.
- CSV: quote-aware parser that emits header/row table chunks.
- TXT/Markdown: direct, structure-aware parsing.
- PNG/JPG/JPEG/WEBP: Gemini OCR; no OCR is invoked for textual files.

Text is normalized without flattening headings, tables, lists, or code. Chunking uses headings, paragraph/sentence boundaries, a 600-token target and 100-token overlap. Each chunk stores source type, page, section, heading path, offsets, token count, content hash, structured metadata, and a real pgvector embedding.

Identical normalized chunks reuse `embedding_cache`; missing chunks are batched through Gemini. Reindex deletes the document’s old chunks, mentions, and evidence edges before rebuilding. Delete removes the document, chunks/vectors (via FK), graph evidence, storage object, and safe orphans.
