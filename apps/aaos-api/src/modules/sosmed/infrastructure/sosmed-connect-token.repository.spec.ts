import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  generateConnectToken,
  SosmedConnectTokenRepository,
} from "./sosmed-connect-token.repository.js";

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "token-row-1",
    tenant_id: "dss-motor",
    token: "abc123",
    sales_human_id: "sales-1",
    expires_at: "2026-08-25T00:00:00.000Z",
    used_at: null,
    created_at: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("generateConnectToken", () => {
  it("returns a high-entropy (64 hex chars = 256 bits) token, not a UUID", () => {
    const token = generateConnectToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different token on each call", () => {
    expect(generateConnectToken()).not.toBe(generateConnectToken());
  });
});

describe("SosmedConnectTokenRepository", () => {
  it("create persists a row with a real token, expires_at, sales_human_id, and used_at: null", async () => {
    const repo = new SosmedConnectTokenRepository(createFakeSupabaseClient());
    const row = await repo.create({
      tenantId: "dss-motor",
      salesHumanId: "sales-1",
      expiresAt: "2026-08-25T00:00:00.000Z",
    });
    expect(row.token).toMatch(/^[0-9a-f]{64}$/);
    expect(row.sales_human_id).toBe("sales-1");
    expect(row.expires_at).toBe("2026-08-25T00:00:00.000Z");
    expect(row.used_at).toBeNull();
  });

  it("findByToken returns undefined for an unknown token", async () => {
    const repo = new SosmedConnectTokenRepository(createFakeSupabaseClient());
    expect(await repo.findByToken("unknown")).toBeUndefined();
  });

  it("findByToken returns the seeded row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sosmed_connect_tokens", seedRow());
    const repo = new SosmedConnectTokenRepository(client);
    const row = await repo.findByToken("abc123");
    expect(row?.id).toBe("token-row-1");
  });

  it("findById returns the seeded row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sosmed_connect_tokens", seedRow());
    const repo = new SosmedConnectTokenRepository(client);
    const row = await repo.findById("token-row-1");
    expect(row?.token).toBe("abc123");
  });

  it("markUsed sets used_at, and the row is then observably used on a subsequent read", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sosmed_connect_tokens", seedRow());
    const repo = new SosmedConnectTokenRepository(client);

    await repo.markUsed("token-row-1", "2026-08-24T12:00:00.000Z");

    const row = await repo.findById("token-row-1");
    expect(row?.used_at).toBe("2026-08-24T12:00:00.000Z");
  });
});
