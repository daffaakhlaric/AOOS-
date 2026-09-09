import { describe, expect, it, vi } from "vitest";

import { WaGraphClient } from "./wa-graph-client.js";

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function buildClient(fetchImpl: typeof fetch): WaGraphClient {
  return new WaGraphClient({ apiVersion: "v21.0", fetchImpl });
}

describe("WaGraphClient", () => {
  it("debugToken returns is_valid true for a real token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { is_valid: true, app_id: "APP_ID", expires_at: 0 } }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.debugToken({ inputToken: "T", appAccessToken: "APP_ID|SECRET" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isValid).toBe(true);
    }
  });

  it("debugToken surfaces is_valid: false honestly (never throws)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { is_valid: false } }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.debugToken({ inputToken: "T", appAccessToken: "APP_ID|SECRET" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isValid).toBe(false);
    }
  });

  it("getWhatsAppBusinessAccounts maps the real WABA list", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [{ id: "waba-1", name: "DSS Motor WABA" }] }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.getWhatsAppBusinessAccounts({ accessToken: "T" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([{ wabaId: "waba-1", name: "DSS Motor WABA" }]);
    }
  });

  it("getPhoneNumbers maps the real phone number list", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          { id: "phone-1", display_phone_number: "+62 812 0000 0000", verified_name: "DSS Motor" },
        ],
      }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.getPhoneNumbers({ wabaId: "waba-1", accessToken: "T" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([
        {
          phoneNumberId: "phone-1",
          displayPhoneNumber: "+62 812 0000 0000",
          verifiedName: "DSS Motor",
        },
      ]);
    }
  });

  it("registerWebhookSubscription posts and returns ok(true) on success", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      return jsonResponse({ success: true });
    }) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.registerWebhookSubscription({ wabaId: "waba-1", accessToken: "T" });
    expect(result.ok).toBe(true);
  });

  it("registerWebhookSubscription returns a Result.err on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: "Insufficient permission." } }, { status: 403 }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.registerWebhookSubscription({ wabaId: "waba-1", accessToken: "T" });
    expect(result.ok).toBe(false);
  });

  it("returns a Result.err on network failure, never throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.getWhatsAppBusinessAccounts({ accessToken: "T" });
    expect(result.ok).toBe(false);
  });
});
