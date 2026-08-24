import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { WabaConfigRepository, WabaConfigRepositoryError } from "./waba-config.repository.js";

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "waba-1",
    tenant_id: "dss-motor",
    branch_id: "BINTARO",
    phone_number: "+628123456789",
    waba_id: "waba-abc",
    phone_number_id: "phone-abc",
    access_token: "token-abc",
    status: "ACTIVE",
    last_tested_at: null,
    last_test_result: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WabaConfigRepository", () => {
  it("inserts a row and returns it", async () => {
    const client = createFakeSupabaseClient();
    const repo = new WabaConfigRepository(client);
    const row = await repo.insert({
      tenant_id: "dss-motor",
      branch_id: "CINERE",
      phone_number: "+628123456780",
      waba_id: "waba-xyz",
      phone_number_id: "phone-xyz",
      access_token: "token-xyz",
      status: "ACTIVE",
    });
    expect(row.branch_id).toBe("CINERE");
  });

  it("findById returns undefined for a missing row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new WabaConfigRepository(client);
    expect(await repo.findById("missing")).toBeUndefined();
  });

  it("listByTenant filters by tenant_id", async () => {
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    client.seed("waba_configs", seedRow({ id: "waba-2", tenant_id: "other-tenant" }));
    const repo = new WabaConfigRepository(client);
    const rows = await repo.listByTenant("dss-motor");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("waba-1");
  });

  it("findByPhoneNumberId returns the matching row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    client.seed("waba_configs", seedRow({ id: "waba-2", phone_number_id: "phone-def" }));
    const repo = new WabaConfigRepository(client);
    const row = await repo.findByPhoneNumberId("phone-abc");
    expect(row?.id).toBe("waba-1");
  });

  it("findByPhoneNumberId returns undefined for an unrecognized phone_number_id", async () => {
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    const repo = new WabaConfigRepository(client);
    expect(await repo.findByPhoneNumberId("unknown-phone-id")).toBeUndefined();
  });

  it("countByTenant returns the number of configs for the tenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    client.seed("waba_configs", seedRow({ id: "waba-2", branch_id: "CINERE" }));
    const repo = new WabaConfigRepository(client);
    expect(await repo.countByTenant("dss-motor")).toBe(2);
  });

  it("updateById patches the row in place", async () => {
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    const repo = new WabaConfigRepository(client);
    const updated = await repo.updateById("waba-1", { status: "INACTIVE" });
    expect(updated.status).toBe("INACTIVE");
  });

  it("deleteById removes the row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("waba_configs", seedRow());
    const repo = new WabaConfigRepository(client);
    await repo.deleteById("waba-1");
    expect(await repo.findById("waba-1")).toBeUndefined();
  });

  it("throws WabaConfigRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("waba_configs", "boom");
    const repo = new WabaConfigRepository(client);
    await expect(repo.listByTenant("dss-motor")).rejects.toThrow(WabaConfigRepositoryError);
  });
});
