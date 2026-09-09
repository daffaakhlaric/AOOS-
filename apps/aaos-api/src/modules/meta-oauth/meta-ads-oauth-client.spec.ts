import { describe, expect, it, vi } from "vitest";

import { MetaAdsOAuthClient } from "./meta-ads-oauth-client.js";

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function buildClient(fetchImpl: typeof fetch): MetaAdsOAuthClient {
  return new MetaAdsOAuthClient({
    appId: "APP_ID",
    appSecret: "APP_SECRET",
    apiVersion: "v21.0",
    fetchImpl,
  });
}

describe("MetaAdsOAuthClient", () => {
  it("buildAuthorizeUrl includes the ads-scoped scope list and response_type=code", () => {
    const client = buildClient(vi.fn() as unknown as typeof fetch);
    const url = new URL(
      client.buildAuthorizeUrl({
        redirectUri: "https://api.example.com/oauth/meta/callback",
        state: "S1",
      }),
    );
    expect(url.pathname).toBe("/v21.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("APP_ID");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/oauth/meta/callback",
    );
    expect(url.searchParams.get("state")).toBe("S1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("ads_management,ads_read,business_management");
  });

  it("exchangeCodeForToken returns the short-lived token on success", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ access_token: "SHORT", expires_in: 5400 }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.exchangeCodeForToken({ code: "C1", redirectUri: "https://x/cb" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.accessToken).toBe("SHORT");
      expect(result.value.expiresInSeconds).toBe(5400);
    }
  });

  it("exchangeCodeForToken returns a Result.err (never throws) on a Meta API error response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid verification code format." } }, { status: 400 }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.exchangeCodeForToken({ code: "bad", redirectUri: "https://x/cb" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Invalid verification code format.");
    }
  });

  it("exchangeCodeForToken returns a Result.err on a network failure, never throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.exchangeCodeForToken({ code: "C1", redirectUri: "https://x/cb" });
    expect(result.ok).toBe(false);
  });

  it("exchangeCodeForToken returns a Result.err on a malformed (schema-invalid) response body", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ unexpected: "shape" }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.exchangeCodeForToken({ code: "C1", redirectUri: "https://x/cb" });
    expect(result.ok).toBe(false);
  });

  it("getMe returns the real Meta identity", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ id: "1000", name: "Budi Santoso" }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.getMe({ accessToken: "TOKEN" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ fbUserId: "1000", fbUserName: "Budi Santoso" });
    }
  });

  it("getAdAccounts maps account_id, falling back to id when account_id is absent", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            id: "act_111",
            account_id: "111",
            name: "DSS Motor Ads",
            currency: "IDR",
            timezone_name: "Asia/Jakarta",
          },
          { id: "act_222", name: "No account_id variant" },
        ],
      }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.getAdAccounts({ accessToken: "TOKEN" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([
        {
          adAccountId: "111",
          name: "DSS Motor Ads",
          currency: "IDR",
          timezoneName: "Asia/Jakarta",
        },
        {
          adAccountId: "act_222",
          name: "No account_id variant",
          currency: undefined,
          timezoneName: undefined,
        },
      ]);
    }
  });

  it("getAdAccounts returns a Result.err on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid OAuth access token." } }, { status: 401 }),
    ) as unknown as typeof fetch;
    const client = buildClient(fetchImpl);
    const result = await client.getAdAccounts({ accessToken: "BAD" });
    expect(result.ok).toBe(false);
  });
});
