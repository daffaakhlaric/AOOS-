import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  GrowthObjectiveRepository,
  GrowthObjectiveRepositoryError,
} from "./growth-objective.repository.js";

const TENANT = "propertyklik-demo";

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "obj-1",
    tenant_id: TENANT,
    metric: "HOT_LEADS",
    target_value: 50,
    start_date: "2026-01-01",
    end_date: "2026-01-31",
    budget_mode: "BALANCED",
    max_budget_idr: 10_000_000,
    focus_listing_ids: [],
    area_strategy: "SAMANTHA",
    manual_areas: [],
    automation_mode: "ADVISOR",
    status: "DRAFT",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function insertValues(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tenant_id: TENANT,
    metric: "HOT_LEADS",
    target_value: 50,
    start_date: "2026-01-01",
    end_date: "2026-01-31",
    budget_mode: "BALANCED",
    max_budget_idr: null,
    focus_listing_ids: [],
    area_strategy: "SAMANTHA",
    manual_areas: [],
    automation_mode: "ADVISOR",
    status: "DRAFT",
    ...overrides,
  };
}

describe("GrowthObjectiveRepository", () => {
  it("creates a row and returns it", async () => {
    const client = createFakeSupabaseClient();
    const repo = new GrowthObjectiveRepository(client);
    const row = await repo.create(insertValues());
    expect(row.metric).toBe("HOT_LEADS");
    expect(row.status).toBe("DRAFT");
  });

  it("findById returns undefined for a missing row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new GrowthObjectiveRepository(client);
    expect(await repo.findById(TENANT, "missing")).toBeUndefined();
  });

  it("findById is tenant-scoped — a matching id under a different tenant is not returned", async () => {
    const client = createFakeSupabaseClient();
    client.seed("growth_objectives", seedRow({ tenant_id: "other-tenant" }));
    const repo = new GrowthObjectiveRepository(client);
    expect(await repo.findById(TENANT, "obj-1")).toBeUndefined();
  });

  it("findById returns the row for the correct tenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("growth_objectives", seedRow());
    const repo = new GrowthObjectiveRepository(client);
    const row = await repo.findById(TENANT, "obj-1");
    expect(row?.id).toBe("obj-1");
  });

  it("list filters by tenant_id", async () => {
    const client = createFakeSupabaseClient();
    client.seed("growth_objectives", seedRow());
    client.seed("growth_objectives", seedRow({ id: "obj-2", tenant_id: "other-tenant" }));
    const repo = new GrowthObjectiveRepository(client);
    const rows = await repo.list(TENANT);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("obj-1");
  });

  it("update patches the row in place, tenant-scoped", async () => {
    const client = createFakeSupabaseClient();
    client.seed("growth_objectives", seedRow());
    const repo = new GrowthObjectiveRepository(client);
    const updated = await repo.update(TENANT, "obj-1", { status: "ACTIVE" });
    expect(updated.status).toBe("ACTIVE");
  });

  it("throws GrowthObjectiveRepositoryError on a forced Supabase error (create)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("growth_objectives", "boom");
    const repo = new GrowthObjectiveRepository(client);
    await expect(repo.create(insertValues())).rejects.toThrow(GrowthObjectiveRepositoryError);
  });

  it("throws GrowthObjectiveRepositoryError on a forced Supabase error (findById)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("growth_objectives", "boom");
    const repo = new GrowthObjectiveRepository(client);
    await expect(repo.findById(TENANT, "obj-1")).rejects.toThrow(GrowthObjectiveRepositoryError);
  });

  it("throws GrowthObjectiveRepositoryError on a forced Supabase error (list)", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("growth_objectives", "boom");
    const repo = new GrowthObjectiveRepository(client);
    await expect(repo.list(TENANT)).rejects.toThrow(GrowthObjectiveRepositoryError);
  });

  it("throws GrowthObjectiveRepositoryError on a forced Supabase error (update)", async () => {
    const client = createFakeSupabaseClient();
    client.seed("growth_objectives", seedRow());
    client.forceErrorOnce("growth_objectives", "boom");
    const repo = new GrowthObjectiveRepository(client);
    await expect(repo.update(TENANT, "obj-1", { status: "ACTIVE" })).rejects.toThrow(
      GrowthObjectiveRepositoryError,
    );
  });
});
