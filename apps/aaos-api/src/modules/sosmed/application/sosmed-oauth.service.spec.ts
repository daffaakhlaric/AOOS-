import "reflect-metadata";

import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../../test-support/fixtures.js";
import { SalesHumanRepository } from "../../sales/infrastructure/sales-human.repository.js";
import { SosmedAccountRepository } from "../infrastructure/sosmed-account.repository.js";
import { SosmedConnectTokenRepository } from "../infrastructure/sosmed-connect-token.repository.js";
import { MetaOAuthClient } from "../oauth/meta-oauth-client.js";
import { OAuthStateStore } from "../oauth/oauth-state-store.js";

import { SosmedOAuthService } from "./sosmed-oauth.service.js";

const NOW_ISO = "2026-08-24T10:00:00.000Z";

const CONFIGURED = buildTestConfig({
  AAOS_TENANT_ID: "dss-motor",
  META_APP_ID: "APP_ID",
  META_APP_SECRET: "APP_SECRET",
  META_API_VERSION: "v21.0",
  AAOS_API_BASE_URL: "https://api.example.com",
  AAOS_DASHBOARD_BASE_URL: "https://dashboard.example.com",
});

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

/** A happy-path fetchImpl: short-lived -> long-lived -> one Page with a linked IG account. */
function buildHappyPathFetch(): typeof fetch {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(url.toString());
    if (u.pathname.endsWith("/oauth/access_token") && u.searchParams.get("grant_type") === null) {
      return jsonResponse({ access_token: "SHORT_LIVED", expires_in: 5400 });
    }
    if (u.searchParams.get("grant_type") === "fb_exchange_token") {
      return jsonResponse({ access_token: "LONG_LIVED", expires_in: 5183944 });
    }
    if (u.pathname.endsWith("/me/accounts")) {
      return jsonResponse({
        data: [{ id: "page-1", name: "Mobix by DSS Motor", access_token: "PAGE_TOKEN_1" }],
      });
    }
    if (u.pathname.endsWith("/page-1")) {
      return jsonResponse({ id: "page-1", instagram_business_account: { id: "ig-1" } });
    }
    throw new Error(`unexpected URL in test: ${u.toString()}`);
  }) as unknown as typeof fetch;
}

function buildZeroPagesFetch(): typeof fetch {
  return vi.fn(async (url: string | URL) => {
    const u = new URL(url.toString());
    if (u.pathname.endsWith("/oauth/access_token") && u.searchParams.get("grant_type") === null) {
      return jsonResponse({ access_token: "SHORT_LIVED", expires_in: 5400 });
    }
    if (u.searchParams.get("grant_type") === "fb_exchange_token") {
      return jsonResponse({ access_token: "LONG_LIVED", expires_in: 5183944 });
    }
    if (u.pathname.endsWith("/me/accounts")) {
      return jsonResponse({ data: [] });
    }
    throw new Error(`unexpected URL in test: ${u.toString()}`);
  }) as unknown as typeof fetch;
}

function buildFailingCodeExchangeFetch(): typeof fetch {
  return vi.fn(async () =>
    jsonResponse({ error: { message: "Invalid verification code format." } }, { status: 400 }),
  ) as unknown as typeof fetch;
}

interface Harness {
  readonly service: SosmedOAuthService;
  readonly client: FakeSupabaseClient;
  readonly accounts: SosmedAccountRepository;
  readonly connectTokens: SosmedConnectTokenRepository;
  readonly salesHumans: SalesHumanRepository;
  readonly stateStore: OAuthStateStore;
}

function buildHarness(
  options: {
    readonly config?: typeof CONFIGURED;
    readonly fetchImpl?: typeof fetch;
    readonly now?: () => Date;
  } = {},
): Harness {
  const config = options.config ?? CONFIGURED;
  const client = createFakeSupabaseClient();
  const accounts = new SosmedAccountRepository(client);
  const connectTokens = new SosmedConnectTokenRepository(client);
  const salesHumans = new SalesHumanRepository(client);
  const stateStore = new OAuthStateStore(options.now ?? (() => new Date(NOW_ISO)));
  const metaClient =
    options.fetchImpl !== undefined
      ? new MetaOAuthClient({
          appId: config.META_APP_ID,
          appSecret: config.META_APP_SECRET,
          apiVersion: config.META_API_VERSION,
          fetchImpl: options.fetchImpl,
        })
      : undefined;
  const service = new SosmedOAuthService(
    config,
    accounts,
    connectTokens,
    salesHumans,
    stateStore,
    options.now ?? (() => new Date(NOW_ISO)),
    metaClient,
  );
  return { service, client, accounts, connectTokens, salesHumans, stateStore };
}

function seedSalesHuman(
  client: FakeSupabaseClient,
  overrides: Partial<Record<string, unknown>> = {},
) {
  client.seed("sales_humans", {
    id: "sales-1",
    tenant_id: "dss-motor",
    name: "Ahmad Fauzi",
    wa_number: "+628123456789",
    branch_id: "CINERE",
    status: "ACTIVE",
    max_leads_per_day: 20,
    auth_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("SosmedOAuthService — official account flow", () => {
  it("startOfficialOAuth throws UnavailableError when Meta OAuth isn't configured (no META_APP_ID/SECRET, no override)", () => {
    const { service } = buildHarness({
      config: buildTestConfig({
        META_APP_ID: "",
        META_APP_SECRET: "",
        AAOS_API_BASE_URL: "https://api.example.com",
      }),
    });
    expect(() => service.startOfficialOAuth()).toThrow(UnavailableError);
  });

  it("startOfficialOAuth throws UnavailableError when AAOS_API_BASE_URL isn't configured", () => {
    const { service } = buildHarness({
      config: buildTestConfig({
        META_APP_ID: "APP_ID",
        META_APP_SECRET: "APP_SECRET",
        AAOS_API_BASE_URL: "",
      }),
      fetchImpl: buildHappyPathFetch(),
    });
    expect(() => service.startOfficialOAuth()).toThrow(UnavailableError);
  });

  it("startOfficialOAuth returns a real authorizeUrl carrying a freshly issued state", () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const result = service.startOfficialOAuth();
    const url = new URL(result.authorizeUrl);
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v21.0/dialog/oauth");
    expect(url.searchParams.get("state")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/api/v1/sosmed/oauth/official/callback",
    );
  });

  it("handleOfficialCallback reports the denial honestly when Meta's own error/error_description are present", async () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const result = await service.handleOfficialCallback({
      error: "access_denied",
      error_description: "User denied consent",
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("User denied consent");
  });

  it("handleOfficialCallback rejects a callback missing code/state", async () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const result = await service.handleOfficialCallback({});
    expect(result.success).toBe(false);
  });

  it("handleOfficialCallback rejects an unknown/forged state (never issued)", async () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const result = await service.handleOfficialCallback({ code: "CODE", state: "forged-state" });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/state oauth tidak valid/i);
  });

  it("handleOfficialCallback rejects a state that was issued for the SALES_PERSONAL flow (wrong kind)", async () => {
    const { service, connectTokens, stateStore } = buildHarness({
      fetchImpl: buildHappyPathFetch(),
    });
    // Bypass the sales-human FK requirement — we only need a connectTokenId string for the state.
    const row = await connectTokens.create({
      tenantId: "dss-motor",
      salesHumanId: "sales-1",
      expiresAt: "2026-09-01T00:00:00.000Z",
    });
    const state = stateStore.issue({
      kind: "SALES_PERSONAL",
      connectTokenId: row.id,
      salesHumanId: "sales-1",
    });
    const result = await service.handleOfficialCallback({ code: "CODE", state });
    expect(result.success).toBe(false);
  });

  it("handleOfficialCallback — happy path: exchanges code, fetches Pages, creates FACEBOOK + INSTAGRAM sosmed_accounts rows with accountType OFFICIAL and no salesHumanId", async () => {
    const { service, stateStore, accounts } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const state = stateStore.issue({ kind: "OFFICIAL" });

    const result = await service.handleOfficialCallback({ code: "AUTH_CODE", state });

    expect(result.success).toBe(true);
    expect(result.connectedAccounts).toHaveLength(2);
    const rows = await accounts.listByTenant("dss-motor");
    expect(rows).toHaveLength(2);
    const fb = rows.find((r) => r.platform === "FACEBOOK");
    const ig = rows.find((r) => r.platform === "INSTAGRAM");
    expect(fb?.account_type).toBe("OFFICIAL");
    expect(fb?.sales_human_id).toBeNull();
    expect(fb?.page_id).toBe("page-1");
    expect(fb?.access_token).toBe("PAGE_TOKEN_1");
    expect(ig?.account_type).toBe("OFFICIAL");
    expect(ig?.instagram_account_id).toBe("ig-1");
    // Meta's real credential model — the IG row uses the SAME Page access token (see service class doc point 5).
    expect(ig?.access_token).toBe("PAGE_TOKEN_1");
  });

  it("handleOfficialCallback's state is single-use — replaying the same callback a second time fails", async () => {
    const { service, stateStore } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const state = stateStore.issue({ kind: "OFFICIAL" });
    await service.handleOfficialCallback({ code: "AUTH_CODE", state });
    const replay = await service.handleOfficialCallback({ code: "AUTH_CODE", state });
    expect(replay.success).toBe(false);
  });

  it("handleOfficialCallback — zero managed Pages: reports failure honestly and creates no rows", async () => {
    const { service, stateStore, accounts } = buildHarness({ fetchImpl: buildZeroPagesFetch() });
    const state = stateStore.issue({ kind: "OFFICIAL" });
    const result = await service.handleOfficialCallback({ code: "AUTH_CODE", state });
    expect(result.success).toBe(false);
    expect(await accounts.listByTenant("dss-motor")).toHaveLength(0);
  });

  it("handleOfficialCallback — Meta rejects the code: reports failure honestly and creates no rows", async () => {
    const { service, stateStore, accounts } = buildHarness({
      fetchImpl: buildFailingCodeExchangeFetch(),
    });
    const state = stateStore.issue({ kind: "OFFICIAL" });
    const result = await service.handleOfficialCallback({ code: "BAD_CODE", state });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid verification code format.");
    expect(await accounts.listByTenant("dss-motor")).toHaveLength(0);
  });
});

describe("SosmedOAuthService — sales personal-account connect-link flow", () => {
  it("createSalesConnectLink throws NotFoundError for an unknown salesHumanId", async () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    await expect(service.createSalesConnectLink("unknown-sales-human")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("createSalesConnectLink creates a real, durable, single-use, expiring token row (not a bare UUID) for a known sales human", async () => {
    const { service, client } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    seedSalesHuman(client);

    const result = await service.createSalesConnectLink("sales-1");

    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expiresAt).toBe("2026-08-25T10:00:00.000Z"); // NOW_ISO + 24h
    expect(result.connectUrl).toBe(`https://dashboard.example.com/connect/sales/${result.token}`);
    const rows = client.rows("sosmed_connect_tokens");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.used_at).toBeNull();
    expect(rows[0]?.sales_human_id).toBe("sales-1");
  });

  it("startSalesOAuth throws NotFoundError for an unknown token", async () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    await expect(service.startSalesOAuth("unknown-token")).rejects.toThrow(NotFoundError);
  });

  it("startSalesOAuth rejects an EXPIRED connect-link token (real expiry enforcement)", async () => {
    const { service, client } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    seedSalesHuman(client);
    client.seed("sosmed_connect_tokens", {
      id: "token-row-1",
      tenant_id: "dss-motor",
      token: "expired-token",
      sales_human_id: "sales-1",
      expires_at: "2026-08-24T09:59:59.000Z", // 1 second before NOW_ISO
      used_at: null,
      created_at: "2026-08-23T10:00:00.000Z",
    });
    await expect(service.startSalesOAuth("expired-token")).rejects.toThrow(ValidationError);
  });

  it("startSalesOAuth rejects an ALREADY-USED connect-link token (real single-use enforcement)", async () => {
    const { service, client } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    seedSalesHuman(client);
    client.seed("sosmed_connect_tokens", {
      id: "token-row-1",
      tenant_id: "dss-motor",
      token: "used-token",
      sales_human_id: "sales-1",
      expires_at: "2026-09-01T00:00:00.000Z",
      used_at: "2026-08-24T09:00:00.000Z",
      created_at: "2026-08-23T10:00:00.000Z",
    });
    await expect(service.startSalesOAuth("used-token")).rejects.toThrow(ValidationError);
  });

  it("startSalesOAuth — happy path: issues a state bound to the connect token id and sales human", async () => {
    const { service, client, stateStore } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    seedSalesHuman(client);
    const linkResult = await service.createSalesConnectLink("sales-1");

    const startResult = await service.startSalesOAuth(linkResult.token);

    const url = new URL(startResult.authorizeUrl);
    const state = url.searchParams.get("state") as string;
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/api/v1/sosmed/oauth/sales/callback",
    );
    // Consuming the state here (mirrors what handleSalesCallback does) proves it really carries
    // the SALES_PERSONAL flow bound to this sales human — never accepted from client input.
    expect(stateStore.consume(state)).toEqual({
      kind: "SALES_PERSONAL",
      connectTokenId: expect.any(String),
      salesHumanId: "sales-1",
    });
  });

  it("handleSalesCallback rejects an unknown/forged state", async () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const result = await service.handleSalesCallback({ code: "CODE", state: "forged" });
    expect(result.success).toBe(false);
  });

  it("handleSalesCallback rejects a state issued for the OFFICIAL flow (wrong kind)", async () => {
    const { service, stateStore } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const state = stateStore.issue({ kind: "OFFICIAL" });
    const result = await service.handleSalesCallback({ code: "CODE", state });
    expect(result.success).toBe(false);
  });

  it("handleSalesCallback — happy path: persists FACEBOOK + INSTAGRAM rows tied to the sales human FROM THE STATE (never a client-supplied id), and marks the connect token used", async () => {
    const { service, client, accounts, connectTokens } = buildHarness({
      fetchImpl: buildHappyPathFetch(),
    });
    seedSalesHuman(client);
    const linkResult = await service.createSalesConnectLink("sales-1");
    const startResult = await service.startSalesOAuth(linkResult.token);
    const state = new URL(startResult.authorizeUrl).searchParams.get("state") as string;

    const result = await service.handleSalesCallback({ code: "AUTH_CODE", state });

    expect(result.success).toBe(true);
    const rows = await accounts.listByTenant("dss-motor");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.sales_human_id === "sales-1")).toBe(true);
    expect(rows.every((r) => r.account_type === "SALES_PERSONAL")).toBe(true);

    const tokenRow = await connectTokens.findByToken(linkResult.token);
    expect(tokenRow?.used_at).toBe(NOW_ISO);
  });

  it("handleSalesCallback re-validates the connect token is still redeemable at callback time (defense in depth) — rejects if it expired/was used between start and callback", async () => {
    const { service, client, stateStore } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    seedSalesHuman(client);
    const row = await client.rows("sosmed_connect_tokens"); // sanity, unused
    void row;
    const created = await new SosmedConnectTokenRepository(client).create({
      tenantId: "dss-motor",
      salesHumanId: "sales-1",
      expiresAt: "2026-09-01T00:00:00.000Z",
    });
    const state = stateStore.issue({
      kind: "SALES_PERSONAL",
      connectTokenId: created.id,
      salesHumanId: "sales-1",
    });
    // Simulate the link being marked used by a concurrent/earlier redemption before this callback runs.
    await new SosmedConnectTokenRepository(client).markUsed(created.id, "2026-08-24T09:59:00.000Z");

    const result = await service.handleSalesCallback({ code: "AUTH_CODE", state });
    expect(result.success).toBe(false);
  });

  it("handleSalesCallback — a FAILED token exchange does NOT burn the connect-link token (it stays usable)", async () => {
    const { service, client, connectTokens } = buildHarness({
      fetchImpl: buildFailingCodeExchangeFetch(),
    });
    seedSalesHuman(client);
    const linkResult = await service.createSalesConnectLink("sales-1");
    const startResult = await service.startSalesOAuth(linkResult.token);
    const state = new URL(startResult.authorizeUrl).searchParams.get("state") as string;

    const result = await service.handleSalesCallback({ code: "BAD_CODE", state });

    expect(result.success).toBe(false);
    const tokenRow = await connectTokens.findByToken(linkResult.token);
    expect(tokenRow?.used_at).toBeNull(); // NOT burned — the sales human can retry the same link.
  });

  it("handleSalesCallback — zero managed Pages: still marks the token used (a legitimate, completed redemption) and creates no rows", async () => {
    const { service, client, connectTokens, accounts } = buildHarness({
      fetchImpl: buildZeroPagesFetch(),
    });
    seedSalesHuman(client);
    const linkResult = await service.createSalesConnectLink("sales-1");
    const startResult = await service.startSalesOAuth(linkResult.token);
    const state = new URL(startResult.authorizeUrl).searchParams.get("state") as string;

    const result = await service.handleSalesCallback({ code: "AUTH_CODE", state });

    expect(result.success).toBe(false);
    const tokenRow = await connectTokens.findByToken(linkResult.token);
    expect(tokenRow?.used_at).toBe(NOW_ISO);
    expect(await accounts.listByTenant("dss-motor")).toHaveLength(0);
  });
});

describe("SosmedOAuthService — accounts", () => {
  it("listAccounts returns masked DTOs — the raw access_token never appears in the serialized response", async () => {
    const { service, stateStore } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const state = stateStore.issue({ kind: "OFFICIAL" });
    await service.handleOfficialCallback({ code: "AUTH_CODE", state });

    const list = await service.listAccounts();
    const serialized = JSON.stringify(list);
    expect(serialized).not.toContain("PAGE_TOKEN_1");
    expect(list.every((a) => a.maskedAccessToken !== undefined)).toBe(true);
  });

  it("disconnectAccount throws NotFoundError for an unknown id", async () => {
    const { service } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    await expect(service.disconnectAccount("unknown-id")).rejects.toThrow(NotFoundError);
  });

  it("disconnectAccount really deletes the local row (subsequent listAccounts no longer shows it)", async () => {
    const { service, stateStore } = buildHarness({ fetchImpl: buildHappyPathFetch() });
    const state = stateStore.issue({ kind: "OFFICIAL" });
    await service.handleOfficialCallback({ code: "AUTH_CODE", state });
    const [first] = await service.listAccounts();

    await service.disconnectAccount((first as { id: string }).id);

    const remaining = await service.listAccounts();
    expect(remaining.find((a) => a.id === (first as { id: string }).id)).toBeUndefined();
  });
});
