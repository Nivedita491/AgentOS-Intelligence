import { assert, assertEquals } from "jsr:@std/assert@1";
import { semanticChunk } from "./ingestion.ts";
import { deduplicate, fuse, retrievalQueries } from "./hybridRetriever.ts";
import type { RetrievalCandidate } from "./types.ts";

function candidate(overrides: Partial<RetrievalCandidate>): RetrievalCandidate {
  return {
    chunkId: "chunk-1", documentId: "doc-1", documentName: "Test", content: "AgentOS stores source cited organizational knowledge.", metadata: {}, pageNumber: 1, sectionTitle: "Capabilities", headingPath: ["Capabilities"], sourceType: "markdown", retrievalRanks: {}, ...overrides,
  };
}

Deno.test("semantic chunking preserves a heading path and avoids mid-sentence cuts", async () => {
  const chunks = await semanticChunk({
    text: "", pageCount: 1, metadata: {}, blocks: [
      { text: "AgentOS stores organizational knowledge. It preserves citations for each answer.", headingPath: ["Product", "Capabilities"], sectionTitle: "Capabilities", pageNumber: 1 },
    ],
  }, "text/markdown", "markdown", 20, 4);
  assertEquals(chunks.length, 1);
  assertEquals(chunks[0].headingPath, ["Product", "Capabilities"]);
  assert(chunks[0].content.endsWith("answer."));
});

Deno.test("weighted reciprocal-rank fusion rewards evidence returned by multiple retrievers", () => {
  const fused = fuse([
    candidate({ chunkId: "shared", retrievalRanks: { semantic: 1, lexical: 2 }, semanticScore: 0.8, lexicalScore: 0.5 }),
    candidate({ chunkId: "vector-only", retrievalRanks: { semantic: 1 }, semanticScore: 0.9 }),
  ]);
  assertEquals(fused[0].chunkId, "shared");
});

Deno.test("deduplication removes highly overlapping neighboring chunks", () => {
  const rows = deduplicate([
    candidate({ chunkId: "one", content: "AgentOS preserves source citations for organizational knowledge retrieval.", rerankScore: 0.9 }),
    candidate({ chunkId: "two", content: "AgentOS preserves source citations for organizational knowledge retrieval and answers.", rerankScore: 0.8 }),
  ]);
  assertEquals(rows.length, 1);
});

Deno.test("query rewriting retains the user's original query and adds bounded retrieval variants", () => {
  const queries = retrievalQueries("What latest approved product features are available?");
  assertEquals(queries[0], "What latest approved product features are available?");
  assert(queries.length <= 3);
});
