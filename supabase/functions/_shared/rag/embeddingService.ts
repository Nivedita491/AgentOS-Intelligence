import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./types.ts";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export interface EmbeddingProvider {
  embedText(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[]>;
  embedBatch(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]>;
}

export function contentHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  return crypto.subtle.digest("SHA-256", bytes).then((buffer) =>
    [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join(""),
  );
}

export function toPgVector(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding provider returned an invalid ${values.length}-dimension vector.`);
  }
  return `[${values.join(",")}]`;
}

async function retry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 350 * (2 ** attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Embedding request failed.");
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly apiKey: string) {}

  async embedText(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[]> {
    const vectors = await this.embedBatch([text], taskType);
    return vectors[0];
  }

  async embedBatch(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
    if (!texts.length) return [];
    const batches = [] as string[][];
    // The API accepts a batched request; cap it conservatively to contain failures and token use.
    for (let index = 0; index < texts.length; index += 50) batches.push(texts.slice(index, index + 50));
    const vectors: number[][] = [];
    for (const batch of batches) {
      const result = await retry(async () => {
        const response = await fetch(`${GEMINI_API_BASE}/${EMBEDDING_MODEL}:batchEmbedContents`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${EMBEDDING_MODEL}`,
              content: { parts: [{ text }] },
              embedContentConfig: {
                taskType,
                outputDimensionality: EMBEDDING_DIMENSIONS,
              },
            })),
          }),
        });
        if (!response.ok) {
          const body = await response.text();
          const error = new Error(`Gemini embedding request failed (${response.status}): ${body.slice(0, 300)}`);
          if (!RETRYABLE_STATUS.has(response.status)) throw error;
          throw error;
        }
        const body = await response.json();
        const values = (body.embeddings ?? []).map((entry: { values?: number[] }) => entry.values ?? []);
        if (values.length !== batch.length) throw new Error("Gemini returned an incomplete embedding batch.");
        values.forEach((vector: number[]) => toPgVector(vector));
        return values as number[][];
      });
      vectors.push(...result);
    }
    return vectors;
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for semantic embedding.");
  return new GeminiEmbeddingProvider(apiKey);
}

export async function embedQuery(query: string): Promise<number[]> {
  return createEmbeddingProvider().embedText(query, "RETRIEVAL_QUERY");
}
