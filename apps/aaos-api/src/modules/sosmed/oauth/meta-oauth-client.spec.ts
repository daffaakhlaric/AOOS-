import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { MetaOAuthClient, MetaOAuthError, OAUTH_SCOPES } from "./meta-oauth-client.js";

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function buildClient(fetchImpl: typeof fetch): MetaOAuthClient {
  return new MetaOAuthClient({
    appId: "APP_ID",
    appSecret: "APP_SECRET",
    apiVersion: "v21.0",
    fetchImpl,
  });
}

describe("MetaOAuthClient", () => {
  describe("buildAuthorizeUrl", () => {
    it("builds the real dialog/oauth consent URL with client_id/redirect_uri/state/scope", () => {
      const client = buildClient(vi.fn());
      const url = client.buildAuthorizeUrl({
        redirectUri: "https://api.example.com/api/v1/sosmed/oauth/official/callback",
        state: "STATE123",
      });
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe("https://www.facebook.com/v21.0/dialog/oauth");
      expect(parsed.searchParams.get("client_id")).toBe("APP_ID");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://api.example.com/api/v1/sosmed/oauth/official/callback",
      );
      expect(parsed.searchParams.get("state")).toBe("STATE123");
      expect(parsed.searchParams.get("scope")).toBe(OAUTH_SCOPES.join(","));
      expect(parsed.searchParams.get("response_type")).toBe("code");
    });

    it("requests every documented permission scope, including pages_show_list", () => {
      expect(OAUTH_SCOPES).toEqual([
        "pages_show_list",
        "pages_manage_posts",
        "pages_read_engagement",
        "instagram_basic",
        "instagram_content_publish",
      ]);
    });
  });

  describe("exchangeCodeForToken", () => {
    it("GETs /oauth/access_token with client_id/client_secret/redirect_uri/code and parses the token", async () => {
      let capturedUrl: string | undefined;
      const fetchImpl = vi.fn(async (url: string | URL) => {
        capturedUrl = url.toString();
        return jsonResponse({
          access_token: "SHORT_LIVED",
          token_type: "bearer",
          expires_in: 5400,
        });
      });
      const client = buildClient(fetchImpl as unknown as typeof fetch);

      const result = await client.exchangeCodeForToken({
        code: "AUTH_CODE",
        redirectUri: "https://api.example.com/callback",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ accessToken: "SHORT_LIVED", expiresInSeconds: 5400 });
      }
      const url = new URL(capturedUrl as string);
      expect(url.origin + url.pathname).toBe("https://graph.facebook.com/v21.0/oauth/access_token");
      expect(url.searchParams.get("client_id")).toBe("APP_ID");
      expect(url.searchParams.get("client_secret")).toBe("APP_SECRET");
      expect(url.searchParams.get("redirect_uri")).toBe("https://api.example.com/callback");
      expect(url.searchParams.get("code")).toBe("AUTH_CODE");
      expect(url.searchParams.has("grant_type")).toBe(false);
    });

    it("returns Result.err(MetaOAuthError) on a non-2xx Meta error response", async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ error: { message: "Invalid verification code format." } }, { status: 400 }),
      );
      const client = buildClient(fetchImpl as unknown as typeof fetch);

      const result = await client.exchangeCodeForToken({
        code: "BAD_CODE",
        redirectUri: "https://api.example.com/callback",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(MetaOAuthError);
        expect(result.error.message).toBe("Invalid verification code format.");
      }
    });

    it("returns Result.err(MetaOAuthError) on a network failure (never throws)", async () => {
      const fetchImpl = vi.fn(async () => {
        throw new Error("ECONNRESET");
      });
      const client = buildClient(fetchImpl as unknown as typeof fetch);

      const result = await client.exchangeCodeForToken({
        code: "AUTH_CODE",
        redirectUri: "https://api.example.com/callback",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(MetaOAuthError);
      }
    });

    it("returns Result.err(MetaOAuthError) when the response body fails schema validation", async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: "shape" }));
      const client = buildClient(fetchImpl as unknown as typeof fetch);

      const result = await client.exchangeCodeForToken({
        code: "AUTH_CODE",
        redirectUri: "https://api.example.com/callback",
      });

      expect(result.ok).toBe(false);
    });
  });

  describe("exchangeForLongLivedToken", () => {
    it("GETs /oauth/access_token with grant_type=fb_exchange_token and parses the long-lived token", async () => {
      let capturedUrl: string | undefined;
      const fetchImpl = vi.fn(async (url: string | URL) => {
        capturedUrl = url.toString();
        return jsonResponse({
          access_token: "LONG_LIVED",
          token_type: "bearer",
          expires_in: 5183944,
        });
      });
      const client = buildClient(fetchImpl as unknown as typeof fetch);

      const result = await client.exchangeForLongLivedToken({ shortLivedToken: "SHORT_LIVED" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accessToken).toBe("LONG_LIVED");
      }
      const url = new URL(capturedUrl as string);
      expect(url.searchParams.get("grant_type")).toBe("fb_exchange_token");
      expect(url.searchParams.get("client_id")).toBe("APP_ID");
      expect(url.searchParams.get("client_secret")).toBe("APP_SECRET");
      expect(url.searchParams.get("fb_exchange_token")).toBe("SHORT_LIVED");
    });
  });

  describe("getManagedPages", () => {
    it("GETs /me/accounts, then /{page-id}?fields=instagram_business_account for each page, and merges the IG id in", async () => {
      const calls: string[] = [];
      const fetchImpl = vi.fn(async (url: string | URL) => {
        const asUrl = new URL(url.toString());
        calls.push(asUrl.pathname);
        if (asUrl.pathname.endsWith("/me/accounts")) {
          return jsonResponse({
            data: [
              { id: "page-1", name: "Mobix by DSS Motor", access_token: "PAGE_TOKEN_1" },
              { id: "page-2", name: "No IG Page", access_token: "PAGE_TOKEN_2" },
            ],
          });
        }
        if (asUrl.pathname.endsWith("/page-1")) {
          return jsonResponse({ id: "page-1", instagram_business_account: { id: "ig-1" } });
        }
        if (asUrl.pathname.endsWith("/page-2")) {
          return jsonResponse({ id: "page-2" });
        }
        throw new Error(`unexpected URL ${asUrl.toString()}`);
      });
      const client = buildClient(fetchImpl as unknown as typeof fetch);

      const result = await client.getManagedPages({ userAccessToken: "LONG_LIVED" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([
          {
            pageId: "page-1",
            pageName: "Mobix by DSS Motor",
            pageAccessToken: "PAGE_TOKEN_1",
            instagramBusinessAccountId: "ig-1",
          },
          {
            pageId: "page-2",
            pageName: "No IG Page",
            pageAccessToken: "PAGE_TOKEN_2",
          },
        ]);
      }
      expect(calls).toEqual(["/v21.0/me/accounts", "/v21.0/page-1", "/v21.0/page-2"]);
    });

    it("returns Result.err(MetaOAuthError) when /me/accounts itself fails", async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ error: { message: "Invalid OAuth access token." } }, { status: 401 }),
      );
      const client = buildClient(fetchImpl as unknown as typeof fetch);

      const result = await client.getManagedPages({ userAccessToken: "EXPIRED" });

      expect(result.ok).toBe(false);
    });

    it("returns an empty list (never a fabricated page) when the user manages no Pages", async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));
      const client = buildClient(fetchImpl as unknown as typeof fetch);

      const result = await client.getManagedPages({ userAccessToken: "LONG_LIVED" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });
});
