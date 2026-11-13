import { z } from "zod";

const embeddingResponseSchema = z.object({
  data: z.array(z.object({
    embedding: z.array(z.number()).length(1536),
  })).min(1),
});

export async function createEmbedding(input: string): Promise<number[]> {
  const endpoint = process.env.EMBEDDING_API_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL;

  if (!endpoint || !apiKey || !model) {
    throw new Error("Configure EMBEDDING_API_URL, EMBEDDING_API_KEY, and EMBEDDING_MODEL to enable semantic duplicate analysis.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, input: input.slice(0, 12_000) }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Embedding provider returned HTTP ${response.status}.`);
  }

  const parsed = embeddingResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Embedding provider returned an invalid response; expected a 1536-dimensional vector.");
  }
  return parsed.data.data[0].embedding;
}
