import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  mswServer,
  registerOpenAiChatHandler,
  registerOpenAiErrorHandler,
  registerOpenAiMalformedHandler,
} from "../../../test-support/openai-msw.js";

import {
  CHAT_COMPLETIONS_PATH,
  OPENAI_BASE_URL,
  OpenAiApiError,
  OpenAiClient,
} from "./OpenAiClient.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

function makeClient(overrides: Partial<ConstructorParameters<typeof OpenAiClient>[0]> = {}) {
  return new OpenAiClient({ apiKey: "test-key", ...overrides });
}

describe("OpenAiClient", () => {
  it("POST /v1/chat/completions -> the assistant message content", async () => {
    registerOpenAiChatHandler("Halo dari Tamara");
    const client = makeClient();
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Halo dari Tamara");
    }
  });

  it("sends Authorization: Bearer {apiKey} and the messages/model/temperature body", async () => {
    let receivedHeaders: Headers | undefined;
    let receivedBody: unknown;
    mswServer.use(
      http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
        receivedHeaders = request.headers;
        receivedBody = await request.json();
        return HttpResponse.json({
          choices: [{ message: { role: "assistant", content: "ok" } }],
        });
      }),
    );
    const client = makeClient({ apiKey: "sk-abc123" });
    await client.createChatCompletion({
      messages: [{ role: "system", content: "sys" }],
      model: "gpt-4o-mini",
      temperature: 0.2,
    });
    expect(receivedHeaders?.get("authorization")).toBe("Bearer sk-abc123");
    expect((receivedBody as { model: string }).model).toBe("gpt-4o-mini");
    expect((receivedBody as { temperature: number }).temperature).toBe(0.2);
  });

  it("requests response_format: json_object when jsonMode is true", async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ choices: [{ message: { content: "{}" } }] });
      }),
    );
    const client = makeClient();
    await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
      jsonMode: true,
    });
    expect((receivedBody as { response_format: { type: string } }).response_format).toEqual({
      type: "json_object",
    });
  });

  it("does not include response_format when jsonMode is omitted", async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ choices: [{ message: { content: "hi" } }] });
      }),
    );
    const client = makeClient();
    await client.createChatCompletion({ messages: [{ role: "user", content: "x" }] });
    expect(receivedBody).not.toHaveProperty("response_format");
  });

  it("returns OpenAiApiError with httpStatus on a non-2xx response", async () => {
    registerOpenAiErrorHandler(401);
    const client = makeClient();
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(OpenAiApiError);
      expect(result.error.httpStatus).toBe(401);
    }
  });

  it("returns OpenAiApiError when the response body is missing choices[0].message.content", async () => {
    registerOpenAiMalformedHandler();
    const client = makeClient();
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(OpenAiApiError);
      expect(result.error.message).toContain("missing choices[0].message.content");
    }
  });

  it("returns OpenAiApiError when the response body is not an object (e.g. null)", async () => {
    mswServer.use(
      http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, () => HttpResponse.json(null)),
    );
    const client = makeClient();
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
  });

  it("returns OpenAiApiError when choices[0] is not an object", async () => {
    mswServer.use(
      http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, () =>
        HttpResponse.json({ choices: ["not-an-object"] }),
      ),
    );
    const client = makeClient();
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
  });

  it("returns OpenAiApiError when choices[0].message is not an object", async () => {
    mswServer.use(
      http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, () =>
        HttpResponse.json({ choices: [{ message: "not-an-object" }] }),
      ),
    );
    const client = makeClient();
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
  });

  it("returns OpenAiApiError when the response body is not valid JSON", async () => {
    mswServer.use(
      http.post(
        `${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`,
        () => new HttpResponse("not json", { status: 200 }),
      ),
    );
    const client = makeClient();
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("not valid JSON");
    }
  });

  it("returns OpenAiApiError on a network failure", async () => {
    const client = makeClient({
      fetchImpl: (() => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("network failure");
    }
  });

  it("returns OpenAiApiError with no cause when fetch throws a non-Error value", async () => {
    const client = makeClient({
      fetchImpl: (() => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal -- deliberately exercising the non-Error branch
        throw "not-an-error-instance";
      }) as unknown as typeof fetch,
    });
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.cause).toBeUndefined();
    }
  });

  it("returns OpenAiApiError with no cause when response.json() rejects with a non-Error value", async () => {
    const client = makeClient({
      fetchImpl: (() =>
        Promise.resolve({
          ok: true,
          status: 200,
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- deliberately exercising the non-Error branch
          json: () => Promise.reject("bad-json-non-error"),
        })) as unknown as typeof fetch,
    });
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.cause).toBeUndefined();
    }
  });

  it("returns OpenAiApiError when choices[0].message.content is present but not a string", async () => {
    mswServer.use(
      http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, () =>
        HttpResponse.json({ choices: [{ message: { content: 12345 } }] }),
      ),
    );
    const client = makeClient();
    const result = await client.createChatCompletion({
      messages: [{ role: "user", content: "x" }],
    });
    expect(result.ok).toBe(false);
  });

  it("uses a custom baseUrl when provided", async () => {
    let hitCustomHost = false;
    mswServer.use(
      http.post("https://custom.openai.example.com/v1/chat/completions", () => {
        hitCustomHost = true;
        return HttpResponse.json({ choices: [{ message: { content: "ok" } }] });
      }),
    );
    const client = makeClient({ baseUrl: "https://custom.openai.example.com" });
    await client.createChatCompletion({ messages: [{ role: "user", content: "x" }] });
    expect(hitCustomHost).toBe(true);
  });

  it("defaults to gpt-4o-mini when no model is passed", async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ choices: [{ message: { content: "ok" } }] });
      }),
    );
    const client = makeClient();
    await client.createChatCompletion({ messages: [{ role: "user", content: "x" }] });
    expect((receivedBody as { model: string }).model).toBe("gpt-4o-mini");
  });
});
