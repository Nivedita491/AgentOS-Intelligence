import type { DocChunk, RetrievalCandidateDebug } from '@/types';

function scoreTextMatch(text: string, query: string): number {
  const normalized = text.toLowerCase();
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  let score = 0;
  for (const term of terms) {
    if (normalized.includes(term)) score += 1;
  }
  return score / Math.max(1, terms.length);
}

function scoreMetadataMatch(chunk: DocChunk, query: string): number {
  const metadata = JSON.stringify(chunk.metadata_json ?? {}).toLowerCase();
  const normalized = query.toLowerCase();
  return normalized.split(/\W+/).filter(Boolean).reduce((sum, term) => sum + (metadata.includes(term) ? 1 : 0), 0) / Math.max(1, normalized.split(/\W+/).filter(Boolean).length);
}

export function rankFallbackChunks(chunks: DocChunk[], query: string): RetrievalCandidateDebug[] {
  const scored = chunks.map((chunk) => {
    const semanticScore = scoreTextMatch(chunk.content, query);
    const lexicalScore = scoreTextMatch(`${chunk.section_title ?? chunk.section_name ?? ''} ${chunk.content}`, query) * 0.9;
    const metadataScore = scoreMetadataMatch(chunk, query) * 0.8;
    const graphScore = chunk.metadata_json?.graph_related ? 0.75 : 0;
    const fusedScore = semanticScore * 0.45 + lexicalScore * 0.25 + metadataScore * 0.2 + graphScore * 0.1;

    return {
      chunkId: chunk.id,
      documentId: chunk.document_id,
      documentName: '',
      content: chunk.content,
      pageNumber: chunk.page_number,
      sectionTitle: chunk.section_title ?? chunk.section_name,
      headingPath: chunk.heading_path ?? [],
      sourceType: 'fallback',
      semanticScore: Number(semanticScore.toFixed(3)),
      lexicalScore: Number(lexicalScore.toFixed(3)),
      metadataScore: Number(metadataScore.toFixed(3)),
      graphScore: Number(graphScore.toFixed(3)),
      fusedScore: Number(fusedScore.toFixed(3)),
      rerankScore: Number(fusedScore.toFixed(3)),
    };
  });

  return scored.sort((a, b) => (b.fusedScore ?? 0) - (a.fusedScore ?? 0)).slice(0, 6);
}
