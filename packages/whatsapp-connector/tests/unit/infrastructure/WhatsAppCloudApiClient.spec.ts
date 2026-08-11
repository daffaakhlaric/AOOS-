import { describe, expect, it, vi } from "vitest";

import {
  ApiServerError,
  AuthError,
  RateLimitError,
  TemplateError,
  WhatsAppApiError,
} from "../../../src/domain/errors/index.js";
import { WhatsAppCloudApiClient } from "../../../src/infrastructure/whatsapp-api/WhatsAppCloudApiClient.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function textInput() {
  return {
    phoneNumberId: "100000000000001",
    accessToken: "token",
    to: "+628123456789",
    body: "hi",
  };
}

describe("WhatsAppCloudApiClient", () => {
  it("sendText succeeds", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        messaging_product: "whatsapp",
        contacts: [{ input: "+628123456789", wa_id: "628123456789" }],
        messages: [{ id: "wamid.1" }],
      }),
    );
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = unwrap(await client.sendText(textInput()));
    expect(result.messages[0]?.id).toBe("wamid.1");
  });

  it("sendTemplate and sendInteractive delegate to the same send path", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        messaging_product: "whatsapp",
        contacts: [],
        messages: [{ id: "wamid.2" }],
      }),
    );
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const templateResult = unwrap(
      await client.sendTemplate({
        phoneNumberId: "1",
        accessToken: "t",
        to: "+628123456789",
        templateName: "hello_world",
        languageCode: "id",
        bodyParameters: [],
      }),
    );
    expect(templateResult.messages[0]?.id).toBe("wamid.2");

    const interactiveResult = unwrap(
      await client.sendInteractive({
        phoneNumberId: "1",
        accessToken: "t",
        to: "+628123456789",
        bodyText: "hi",
        buttons: [{ id: "yes", title: "Yes" }],
      }),
    );
    expect(interactiveResult.messages[0]?.id).toBe("wamid.2");
  });

  it("returns ApiServerError when the success response body is not JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("<not json>", { status: 200 }));
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(ApiServerError);
    expect(error.message).toContain("non-JSON response body");
  });

  it("returns ApiServerError on a network failure (fetch throws an Error)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(ApiServerError);
    expect(error.message).toContain("ECONNRESET");
  });

  it("returns ApiServerError on a network failure (fetch throws a non-Error value)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw "raw string failure";
    });
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error.message).toContain("raw string failure");
  });

  it("falls back to a generic HTTP-status message when the error body is not JSON", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("<not json>", { status: 500, headers: { "content-type": "text/plain" } }),
    );
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(ApiServerError);
    expect(error.message).toContain("HTTP 500");
  });

  it("maps Meta error code 190 to AuthError regardless of HTTP status", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: "bad token", code: 190 } }, { status: 400 }),
    );
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(AuthError);
  });

  it("maps Meta error code 132000 to TemplateError", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: "bad template", code: 132000 } }, { status: 400 }),
    );
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(TemplateError);
  });

  it("maps a bare HTTP 401 (no Meta error code) to AuthError", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 401 }));
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(AuthError);
  });

  it("maps a bare HTTP 503 to ApiServerError", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(ApiServerError);
  });

  it("maps an unlisted HTTP status with no Meta error code to the generic WhatsAppApiError", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 418 }));
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(WhatsAppApiError);
    expect(error.constructor).toBe(WhatsAppApiError);
    expect(error.httpStatus).toBe(418);
  });

  it("429 with no retry-after header defaults to DEFAULT_RETRY_AFTER_MS", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 429 }));
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBe(1000);
  });

  it("429 with a numeric retry-after header converts seconds to ms", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 429, headers: { "retry-after": "5" } }),
    );
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect((error as RateLimitError).retryAfterMs).toBe(5000);
  });

  it("429 with an HTTP-date retry-after header computes the ms difference", async () => {
    const future = new Date(Date.now() + 10_000).toUTCString();
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 429, headers: { "retry-after": future } }),
    );
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect((error as RateLimitError).retryAfterMs).toBeGreaterThan(0);
  });

  it("429 with an unparsable retry-after header falls back to DEFAULT_RETRY_AFTER_MS", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 429, headers: { "retry-after": "not-a-value!!" } }),
    );
    const client = new WhatsAppCloudApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const error = unwrapErr(await client.sendText(textInput()));
    expect((error as RateLimitError).retryAfterMs).toBe(1000);
  });

  it("uses the real global fetch by default when no fetchImpl is provided", () => {
    const client = new WhatsAppCloudApiClient();
    expect(client).toBeInstanceOf(WhatsAppCloudApiClient);
  });
});
