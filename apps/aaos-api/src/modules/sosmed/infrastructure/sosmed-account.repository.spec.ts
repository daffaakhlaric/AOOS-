import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  SosmedAccountRepository,
  type CreateSosmedAccountInput,
} from "./sosmed-account.repository.js";

const BASE_INPUT: CreateSosmedAccountInput = {
  id: "11111111-1111-1111-1111-111111111111",
  tenantId: "dss-motor",
  platform: "FACEBOOK",
  accountType: "OFFICIAL",
  accountName: "Mobix by DSS Motor",
  pageId: "page-1",
  accessToken: "REAL_PAGE_ACCESS_TOKEN",
};

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "acc-1",
    tenant_id: "dss-motor",
    sales_human_id: null,
    platform: "FACEBOOK",
    account_type: "OFFICIAL",
    account_name: "Mobix by DSS Motor",
    username: null,
    page_id: "page-1",
    instagram_account_id: null,
    access_token: "REAL_PAGE_ACCESS_TOKEN",
    token_expires_at: null,
    follower_count: 0,
    profile_pic_url: null,
    status: "CONNECTED",
    last_sync_at: null,
    created_at: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("SosmedAccountRepository", () => {
  it("insert persists the real access token as plain text (matching waba_configs' precedent) and defaults status to CONNECTED", async () => {
    const repo = new SosmedAccountRepository(createFakeSupabaseClient());
    const row = await repo.insert(BASE_INPUT);

    expect(row.access_token).toBe("REAL_PAGE_ACCESS_TOKEN");
    expect(row.status).toBe("CONNECTED");
    expect(row.follower_count).toBe(0);
    expect(row.account_type).toBe("OFFICIAL");
  });

  it("insert persists sales_human_id when supplied (SALES_PERSONAL accounts)", async () => {
    const repo = new SosmedAccountRepository(createFakeSupabaseClient());
    const row = await repo.insert({
      ...BASE_INPUT,
      id: "22222222-2222-2222-2222-222222222222",
      accountType: "SALES_PERSONAL",
      salesHumanId: "sales-1",
    });
    expect(row.sales_human_id).toBe("sales-1");
    expect(row.account_type).toBe("SALES_PERSONAL");
  });

  it("findById returns undefined when no row exists", async () => {
    const repo = new SosmedAccountRepository(createFakeSupabaseClient());
    expect(await repo.findById("does-not-exist")).toBeUndefined();
  });

  it("findById returns the seeded row, including the real access_token", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sosmed_accounts", seedRow());
    const repo = new SosmedAccountRepository(client);
    const row = await repo.findById("acc-1");
    expect(row?.access_token).toBe("REAL_PAGE_ACCESS_TOKEN");
  });

  it("listByTenant is scoped by tenant and returns real (unmasked) rows for the caller to mask", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sosmed_accounts", seedRow());
    client.seed("sosmed_accounts", seedRow({ id: "acc-2", tenant_id: "other-tenant" }));
    const repo = new SosmedAccountRepository(client);
    const rows = await repo.listByTenant("dss-motor");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("acc-1");
    expect(rows[0]?.access_token).toBe("REAL_PAGE_ACCESS_TOKEN");
  });

  it("deleteById removes the row (real local disconnect)", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sosmed_accounts", seedRow());
    const repo = new SosmedAccountRepository(client);
    await repo.deleteById("acc-1");
    expect(await repo.findById("acc-1")).toBeUndefined();
  });
});
