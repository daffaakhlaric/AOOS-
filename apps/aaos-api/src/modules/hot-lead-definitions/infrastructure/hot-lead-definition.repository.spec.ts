import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  HotLeadDefinitionRepository,
  HotLeadDefinitionRepositoryError,
} from "./hot-lead-definition.repository.js";

const TENANT = "propertyklik-demo";

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "def-1",
    tenant_id: TENANT,
    mode: "LEAD_STATUS",
    lead_status_value: "HOT",
    rules: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("HotLeadDefinitionRepository", () => {
  it("findByTenant returns undefined when the tenant has no stored definition", async () => {
    const client = createFakeSupabaseClient();
    const repo = new HotLeadDefinitionRepository(client);
    expect(await repo.findByTenant(TENANT)).toBeUndefined();
  });

  it("findByTenant returns the row for that tenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("hot_lead_definitions", seedRow());
    const repo = new HotLeadDefinitionRepository(client);
    const row = await repo.findByTenant(TENANT);
    expect(row?.mode).toBe("LEAD_STATUS");
  });

  it("findByTenant does not return another tenant's row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("hot_lead_definitions", seedRow({ tenant_id: "other-tenant" }));
    const repo = new HotLeadDefinitionRepository(client);
    expect(await repo.findByTenant(TENANT)).toBeUndefined();
  });

  it("upsert inserts a new row when the tenant has none yet", async () => {
    const client = createFakeSupabaseClient();
    const repo = new HotLeadDefinitionRepository(client);
    const row = await repo.upsert({
      tenantId: TENANT,
      mode: "LEAD_STATUS",
      leadStatusValue: "HOT",
      rules: null,
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(row.mode).toBe("LEAD_STATUS");
    expect(row.lead_status_value).toBe("HOT");
    expect(client.rows("hot_lead_definitions")).toHaveLength(1);
  });

  it("upsert updates the existing row in place (no duplicate) on a second call", async () => {
    const client = createFakeSupabaseClient();
    const repo = new HotLeadDefinitionRepository(client);
    await repo.upsert({
      tenantId: TENANT,
      mode: "LEAD_STATUS",
      leadStatusValue: "HOT",
      rules: null,
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    const updated = await repo.upsert({
      tenantId: TENANT,
      mode: "RULE_BASED",
      leadStatusValue: null,
      rules: [{ field: "score", operator: ">=", value: 65 }],
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
    expect(updated.mode).toBe("RULE_BASED");
    expect(client.rows("hot_lead_definitions")).toHaveLength(1);
  });

  it("throws HotLeadDefinitionRepositoryError on a forced Supabase error (findByTenant)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("hot_lead_definitions", "boom");
    const repo = new HotLeadDefinitionRepository(client);
    await expect(repo.findByTenant(TENANT)).rejects.toThrow(HotLeadDefinitionRepositoryError);
  });

  it("throws HotLeadDefinitionRepositoryError on a forced Supabase error (upsert insert)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("hot_lead_definitions", "boom");
    const repo = new HotLeadDefinitionRepository(client);
    await expect(
      repo.upsert({
        tenantId: TENANT,
        mode: "LEAD_STATUS",
        leadStatusValue: "HOT",
        rules: null,
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
    ).rejects.toThrow(HotLeadDefinitionRepositoryError);
  });

  it("throws HotLeadDefinitionRepositoryError on a forced Supabase error (upsert update)", async () => {
    const client = createFakeSupabaseClient();
    client.seed("hot_lead_definitions", seedRow());
    client.forceErrorOnce("hot_lead_definitions", "boom");
    const repo = new HotLeadDefinitionRepository(client);
    await expect(
      repo.upsert({
        tenantId: TENANT,
        mode: "RULE_BASED",
        leadStatusValue: null,
        rules: [],
        updatedAt: "2026-01-03T00:00:00.000Z",
      }),
    ).rejects.toThrow(HotLeadDefinitionRepositoryError);
  });
});
