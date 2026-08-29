import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  CHAT_COMPLETIONS_PATH,
  OPENAI_BASE_URL,
  OpenAiChatClient,
} from "../../../src/llm/OpenAiChatClient.js";
import { mswServer } from "../../helpers/msw.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const CHAT_URL = `${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`;

describe("OpenAiChatClient (MSW-mocked api.openai.com — zero real network calls)", () => {
  it("success → returns the trimmed message content", async () => {
    mswServer.use(
      http.post(CHAT_URL, () =>
        HttpResponse.json({
          choices: [{ message: { content: "  Halo kak! Ada yang bisa Clara bantu? 😊  " } }],
        }),
      ),
    );
    const client = new OpenAiChatClient({ apiKey: "key" });
    const text = unwrap(await client.complete({ messages: [{ role: "user", content: "halo" }] }));
    expect(text).toBe("Halo kak! Ada yang bisa Clara bantu? 😊");
  });

  it("sends the Authorization header, model, and messages in the request body", async () => {
    let receivedAuth: string | null = null;
    let receivedBody: unknown;
    mswServer.use(
      http.post(CHAT_URL, async ({ request }) => {
        receivedAuth = request.headers.get("authorization");
        receivedBody = await request.json();
        return HttpResponse.json({ choices: [{ message: { content: "ok" } }] });
      }),
    );
    const client = new OpenAiChatClient({ apiKey: "secret-key", model: "gpt-4o-mini" });
    await client.complete({ messages: [{ role: "system", content: "sys" }] });
    expect(receivedAuth).toBe("Bearer secret-key");
    expect((receivedBody as { model: string }).model).toBe("gpt-4o-mini");
    expect((receivedBody as { messages: unknown[] }).messages).toEqual([
      { role: "system", content: "sys" },
    ]);
  });

  it("empty apiKey → VALIDATION_ERROR without making a network call", async () => {
    mswServer.use(
      http.post(CHAT_URL, () => {
        throw new Error("must not be called");
      }),
    );
    const client = new OpenAiChatClient({ apiKey: "   " });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("apiKey is empty");
  });

  it("HTTP 429 → RATE_LIMITED error", async () => {
    mswServer.use(http.post(CHAT_URL, () => new HttpResponse(null, { status: 429 })));
    const client = new OpenAiChatClient({ apiKey: "key" });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("429");
  });

  it("HTTP 401 (or other non-2xx) → UNAVAILABLE error with the status in the message", async () => {
    mswServer.use(http.post(CHAT_URL, () => new HttpResponse(null, { status: 401 })));
    const client = new OpenAiChatClient({ apiKey: "key" });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("401");
  });

  it("network failure (fetch throws) → UNAVAILABLE error", async () => {
    const client = new OpenAiChatClient({
      apiKey: "key",
      fetchImpl: () => Promise.reject(new Error("ECONNREFUSED")),
    });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("network failure");
  });

  it("network failure with a non-Error rejection → still UNAVAILABLE error, no cause attached", async () => {
    const client = new OpenAiChatClient({
      apiKey: "key",
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- exercising the non-Error branch on purpose
      fetchImpl: () => Promise.reject("ECONNREFUSED"),
    });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("network failure");
    expect(error.cause).toBeUndefined();
  });

  it("abort/timeout (fetch rejects with AbortError) → TIMEOUT error", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    const client = new OpenAiChatClient({
      apiKey: "key",
      fetchImpl: () => Promise.reject(abortError),
    });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("timed out");
  });

  it("response body is not valid JSON → UNAVAILABLE error", async () => {
    mswServer.use(http.post(CHAT_URL, () => new HttpResponse("not json{{{", { status: 200 })));
    const client = new OpenAiChatClient({ apiKey: "key" });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("not valid JSON");
  });

  it("response.json() rejects with a non-Error value → still UNAVAILABLE error, no cause attached", async () => {
    const client = new OpenAiChatClient({
      apiKey: "key",
      fetchImpl: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- exercising the non-Error branch on purpose
          json: () => Promise.reject("not an Error instance"),
        } as unknown as Response),
    });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("not valid JSON");
    expect(error.cause).toBeUndefined();
  });

  it("malformed response (not an object) → UNAVAILABLE error", async () => {
    mswServer.use(http.post(CHAT_URL, () => HttpResponse.json("just a string")));
    const client = new OpenAiChatClient({ apiKey: "key" });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("not an object");
  });

  it("malformed response (no choices array) → UNAVAILABLE error", async () => {
    mswServer.use(http.post(CHAT_URL, () => HttpResponse.json({ foo: "bar" })));
    const client = new OpenAiChatClient({ apiKey: "key" });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("no choices");
  });

  it("malformed response (empty choices array) → UNAVAILABLE error", async () => {
    mswServer.use(http.post(CHAT_URL, () => HttpResponse.json({ choices: [] })));
    const client = new OpenAiChatClient({ apiKey: "key" });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("no choices");
  });

  it("malformed response (empty/whitespace content) → UNAVAILABLE error", async () => {
    mswServer.use(
      http.post(CHAT_URL, () => HttpResponse.json({ choices: [{ message: { content: "   " } }] })),
    );
    const client = new OpenAiChatClient({ apiKey: "key" });
    const error = unwrapErr(await client.complete({ messages: [] }));
    expect(error.message).toContain("empty content");
  });

  it("uses a custom baseUrl when provided", async () => {
    mswServer.use(
      http.post(`https://custom.openai.example${CHAT_COMPLETIONS_PATH}`, () =>
        HttpResponse.json({ choices: [{ message: { content: "custom-ok" } }] }),
      ),
    );
    const client = new OpenAiChatClient({
      apiKey: "key",
      baseUrl: "https://custom.openai.example",
    });
    const text = unwrap(await client.complete({ messages: [] }));
    expect(text).toBe("custom-ok");
  });
});
