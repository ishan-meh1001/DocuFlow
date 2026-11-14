import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmbedding } from "./embeddings";

const vector = Array.from({ length: 1536 }, (_, index) => index / 1536);

describe("createEmbedding", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses Gemini's native API and requests 1536-dimensional similarity embeddings", async () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "gemini");
    vi.stubEnv("EMBEDDING_MODEL", "gemini-embedding-2");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: vector } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createEmbedding("Docs for the API")).resolves.toEqual(vector);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent");
    expect(options?.headers).toMatchObject({ "x-goog-api-key": "test-gemini-key" });
    expect(JSON.parse(String(options?.body))).toEqual({
      model: "models/gemini-embedding-2",
      content: { parts: [{ text: "task: sentence similarity | query: Docs for the API" }] },
      output_dimensionality: 1536,
    });
  });

  it("keeps the OpenAI-compatible provider working", async () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "openai-compatible");
    vi.stubEnv("EMBEDDING_API_URL", "https://embeddings.example/v1/embeddings");
    vi.stubEnv("EMBEDDING_API_KEY", "test-api-key");
    vi.stubEnv("EMBEDDING_MODEL", "test-model");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: vector }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createEmbedding("Docs for the API")).resolves.toEqual(vector);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://embeddings.example/v1/embeddings");
    expect(options?.headers).toMatchObject({ authorization: "Bearer test-api-key" });
    expect(JSON.parse(String(options?.body))).toEqual({
      model: "test-model",
      input: "Docs for the API",
    });
  });

  it("rejects Gemini responses with the wrong vector dimension", async () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "gemini");
    vi.stubEnv("EMBEDDING_MODEL", "gemini-embedding-2");
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: vector.slice(1) } }), { status: 200 }),
    ));

    await expect(createEmbedding("Docs for the API")).rejects.toThrow(
      "Gemini returned an invalid response; expected a 1536-dimensional vector.",
    );
  });
});
