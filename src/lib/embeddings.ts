import { z } from "zod";

const DIMENSIONS = 1536;
const DEFAULT_PROVIDER = "openai-compatible";
const GEMINI_MODEL_PREFIX = "gemini-embedding-";
const geminiResponseSchema = z.object({
  embedding: z.object({
    values: z.array(z.number()).length(DIMENSIONS),
  }),
});

const openAICompatibleResponseSchema = z.object({
  data: z.array(z.object({
    embedding: z.array(z.number()).length(DIMENSIONS),
  })).min(1),
});

export async function createEmbedding(input: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER || DEFAULT_PROVIDER;
  const model = process.env.EMBEDDING_MODEL;

  if (!model) {
    throw new Error("Configure EMBEDDING_MODEL to enable semantic duplicate analysis.");
  }

  if (provider === "gemini") {
    return createGeminiEmbedding(input, model);
  }
  if (provider !== DEFAULT_PROVIDER) {
    throw new Error(`Unsupported embedding provider: ${provider}.`);
  }

  const endpoint = process.env.EMBEDDING_API_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error("Configure EMBEDDING_API_URL and EMBEDDING_API_KEY for the OpenAI-compatible embedding provider.");
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

  const parsed = openAICompatibleResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Embedding provider returned an invalid response; expected a 1536-dimensional vector.");
  }
  return parsed.data.data[0].embedding;
}

async function createGeminiEmbedding(input: string, model: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Configure GEMINI_API_KEY to use the Gemini embedding provider.");
  }
  if (!model.startsWith(GEMINI_MODEL_PREFIX)) {
    throw new Error(`Gemini embedding model must start with "${GEMINI_MODEL_PREFIX}".`);
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: {
          parts: [{ text: `task: sentence similarity | query: ${input.slice(0, 12_000)}` }],
        },
        output_dimensionality: DIMENSIONS,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini embedding provider returned HTTP ${response.status}.`);
  }

  const parsed = geminiResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Gemini returned an invalid response; expected a 1536-dimensional vector.");
  }
  return parsed.data.embedding.values;
}
