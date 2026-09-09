import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import type { WebhookSecretsService } from "../webhook-config/webhook-secrets.service.js";

import { WaGraphClient } from "./wa-graph-client.js";
import { WaOAuthService } from "./wa-oauth.service.js";

const CONFIG = buildTestConfig({
  META_API_VERSION: "v21.0",
  META_APP_ID: "APP_ID",
  META_APP_SECRET: "APP_SECRET",
});

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function buildFakeWebhookSecrets(verifyToken: string): WebhookSecretsService {
  return {
    getMetaSecrets: vi.fn(),
    getWhatsappSecrets: vi.fn(async () => ({ verifyToken, appSecret: "app-secret" })),
    invalidate: vi.fn(),
  } as unknown as WebhookSecretsService;
}

function buildHarness(
  options: { readonly fetchImpl?: typeof fetch; readonly verifyToken?: string } = {},
) {
  const client = createFakeSupabaseClient();
  const wabaConfigs = new WabaConfigRepository(client);
  const webhookSecrets = buildFakeWebhookSecrets(options.verifyToken ?? "real-verify-token");
  const waGraphClient =
    options.fetchImpl !== undefined
      ? new WaGraphClient({ apiVersion: "v21.0", fetchImpl: options.fetchImpl })
      : undefined;
  const service = new WaOAuthService(
    CONFIG,
    wabaConfigs,
    webhookSecrets,
    waGraphClient,
    () => new Date("2026-09-09T10:00:00.000Z"),
  );
  return { service, client, wabaConfigs };
}

function buildHappyPathSignupFetch(): typeof fetch {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = new URL(url.toString());
    if (u.pathname.endsWith("/debug_token")) {
      return jsonResponse({ data: { is_valid: true, app_id: "APP_ID" } });
    }
    if (u.pathname.endsWith("/me/whatsapp_business_accounts")) {
      return jsonResponse({ data: [{ id: "waba-1", name: "DSS Motor WABA" }] });
    }
    if (u.pathname.endsWith("/phone_numbers")) {
      return jsonResponse({ data: [{ id: "phone-1", display_phone_number: "+62 812 0000 0000" }] });
    }
    if (u.pathname.endsWith("/subscribed_apps") && init?.method === "POST") {
      return jsonResponse({ success: true });
    }
    throw new Error(`unexpected URL in test: ${u.toString()}`);
  }) as unknown as typeof fetch;
}

describe("WaOAuthService.handleEmbeddedSignupToken", () => {
  it("succeeds: verifies token, discovers WABA + phone number, upserts waba_configs PLAIN TEXT, registers webhook", async () => {
    const { service, client } = buildHarness({ fetchImpl: buildHappyPathSignupFetch() });
    const result = await service.handleEmbeddedSignupToken("dss-motor", "SIGNUP_TOKEN", "pusat");
    expect(result.success).toBe(true);

    const rows = client.rows("waba_configs");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["tenant_id"]).toBe("dss-motor");
    expect(rows[0]?.["waba_id"]).toBe("waba-1");
    expect(rows[0]?.["phone_number_id"]).toBe("phone-1");
    // Deliberately PLAIN TEXT — see WaOAuthService's own class doc for why.
    expect(rows[0]?.["access_token"]).toBe("SIGNUP_TOKEN");
    expect(rows[0]?.["config_source"]).toBe("embedded_signup");
    expect(rows[0]?.["webhook_verified"]).toBe(true);
  });

  it("updates (not duplicates) an existing row matched by phone_number_id", async () => {
    const { service, client } = buildHarness({ fetchImpl: buildHappyPathSignupFetch() });
    client.seed("waba_configs", {
      id: "existing-1",
      tenant_id: "dss-motor",
      branch_id: "old-branch",
      phone_number: "+62 812 0000 0000",
      waba_id: "waba-1",
      phone_number_id: "phone-1",
      access_token: "OLD_TOKEN",
      status: "ACTIVE",
      last_tested_at: null,
      last_test_result: null,
      config_source: "manual",
      webhook_verified: false,
      webhook_verified_at: null,
      fb_user_id: null,
      fb_user_name: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    await service.handleEmbeddedSignupToken("dss-motor", "SIGNUP_TOKEN", "pusat");
    expect(client.rows("waba_configs")).toHaveLength(1);
    expect(client.rows("waba_configs")[0]?.["access_token"]).toBe("SIGNUP_TOKEN");
    expect(client.rows("waba_configs")[0]?.["config_source"]).toBe("embedded_signup");
  });

  it("fails honestly when the token is invalid (debug_token: is_valid false)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { is_valid: false } }),
    ) as unknown as typeof fetch;
    const { service, client } = buildHarness({ fetchImpl });
    const result = await service.handleEmbeddedSignupToken("dss-motor", "BAD_TOKEN", "pusat");
    expect(result.success).toBe(false);
    expect(client.rows("waba_configs")).toHaveLength(0);
  });

  it("fails honestly when Meta's API errors on discovery", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = new URL(url.toString());
      if (u.pathname.endsWith("/debug_token")) {
        return jsonResponse({ data: { is_valid: true } });
      }
      return jsonResponse({ error: { message: "Unsupported request." } }, { status: 400 });
    }) as unknown as typeof fetch;
    const { service } = buildHarness({ fetchImpl });
    const result = await service.handleEmbeddedSignupToken("dss-motor", "TOKEN", "pusat");
    expect(result.success).toBe(false);
  });

  it("reports META_APP_ID/META_APP_SECRET unset without ever calling the network", async () => {
    const client = createFakeSupabaseClient();
    const wabaConfigs = new WabaConfigRepository(client);
    const webhookSecrets = buildFakeWebhookSecrets("token");
    const unconfigured = buildTestConfig({ META_APP_ID: "", META_APP_SECRET: "" });
    const service = new WaOAuthService(
      unconfigured,
      wabaConfigs,
      webhookSecrets,
      undefined,
      () => new Date(),
    );
    const result = await service.handleEmbeddedSignupToken("dss-motor", "TOKEN", "pusat");
    expect(result.success).toBe(false);
  });
});

describe("WaOAuthService.setupManual", () => {
  it("saves a config_source: 'manual' row when the real Graph API phone-number check succeeds", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ verified_name: "DSS Motor" }),
    ) as unknown as typeof fetch;
    try {
      const { service, client } = buildHarness();
      const result = await service.setupManual("dss-motor", {
        branchId: "pusat",
        wabaId: "waba-1",
        phoneNumberId: "phone-1",
        phoneNumber: "+62 812 0000 0000",
        accessToken: "MANUAL_TOKEN",
      });
      expect(result.success).toBe(true);
      expect(client.rows("waba_configs")[0]?.["config_source"]).toBe("manual");
      expect(client.rows("waba_configs")[0]?.["access_token"]).toBe("MANUAL_TOKEN");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails honestly (and does not save) when the real Graph API check fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid access token." } }, { status: 400 }),
    ) as unknown as typeof fetch;
    try {
      const { service, client } = buildHarness();
      const result = await service.setupManual("dss-motor", {
        branchId: "pusat",
        wabaId: "waba-1",
        phoneNumberId: "phone-1",
        phoneNumber: "+62 812 0000 0000",
        accessToken: "BAD_TOKEN",
      });
      expect(result.success).toBe(false);
      expect(client.rows("waba_configs")).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("WaOAuthService.verifyWebhook", () => {
  it("succeeds (echoes challenge) on a matching hub.verify_token", async () => {
    const { service } = buildHarness({ verifyToken: "real-token" });
    const result = await service.verifyWebhook("subscribe", "real-token", "challenge-123");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.challenge).toBe("challenge-123");
    }
  });

  it("fails on a hub.verify_token mismatch", async () => {
    const { service } = buildHarness({ verifyToken: "real-token" });
    const result = await service.verifyWebhook("subscribe", "wrong-token", "challenge-123");
    expect(result.ok).toBe(false);
  });

  it("fails on a missing hub.mode/hub.verify_token/hub.challenge", async () => {
    const { service } = buildHarness({ verifyToken: "real-token" });
    const result = await service.verifyWebhook(undefined, undefined, undefined);
    expect(result.ok).toBe(false);
  });
});

describe("WaOAuthService.getToken", () => {
  it("returns the first ACTIVE row's access_token", async () => {
    const { service, client } = buildHarness();
    client.seed("waba_configs", {
      id: "w-1",
      tenant_id: "dss-motor",
      branch_id: "pusat",
      phone_number: "+62 812 0000 0000",
      waba_id: "waba-1",
      phone_number_id: "phone-1",
      access_token: "ACTIVE_TOKEN",
      status: "ACTIVE",
      last_tested_at: null,
      last_test_result: null,
      config_source: "manual",
      webhook_verified: false,
      webhook_verified_at: null,
      fb_user_id: null,
      fb_user_name: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const token = await service.getToken("dss-motor");
    expect(token).toBe("ACTIVE_TOKEN");
  });

  it("throws when the tenant has no ACTIVE waba_configs row", async () => {
    const { service } = buildHarness();
    await expect(service.getToken("dss-motor")).rejects.toThrow();
  });
});
