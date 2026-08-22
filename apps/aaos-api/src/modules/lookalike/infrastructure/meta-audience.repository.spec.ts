import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  MetaAudienceRepository,
  type CreateMetaAudienceInput,
} from "./meta-audience.repository.js";

const BASE_INPUT: CreateMetaAudienceInput = {
  id: "11111111-1111-1111-1111-111111111111",
  tenantId: "dss-motor",
  metaAudienceId: "audience-1",
  audienceType: "HOT_LEADS",
  name: "AAOS-HotLeads-dss-motor-Aug2026",
};

describe("MetaAudienceRepository", () => {
  it("create persists an ACTIVE audience with no size yet", async () => {
    const repo = new MetaAudienceRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);

    expect(created.id).toBe(BASE_INPUT.id);
    expect(created.status).toBe("ACTIVE");
    expect(created.metaAudienceId).toBe("audience-1");
    expect(created.size).toBeUndefined();
  });

  it("findByTenantAndType returns undefined when no row of that type exists", async () => {
    const repo = new MetaAudienceRepository(createFakeSupabaseClient());
    expect(await repo.findByTenantAndType("dss-motor", "HOT_LEADS")).toBeUndefined();
  });

  it("findByTenantAndType returns the stored row", async () => {
    const repo = new MetaAudienceRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    const found = await repo.findByTenantAndType("dss-motor", "HOT_LEADS");
    expect(found?.metaAudienceId).toBe("audience-1");
  });

  it("findByTenantAndType is scoped by tenant", async () => {
    const repo = new MetaAudienceRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    expect(await repo.findByTenantAndType("other-tenant", "HOT_LEADS")).toBeUndefined();
  });

  it("listByTenant returns every audience for a tenant, both HOT_LEADS and LOOKALIKE_*", async () => {
    const repo = new MetaAudienceRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    await repo.create({
      id: "22222222-2222-2222-2222-222222222222",
      tenantId: "dss-motor",
      metaAudienceId: "lookalike-1",
      audienceType: "LOOKALIKE_1PCT",
      name: "AAOS-Lookalike-1pct-dss-motor",
      originAudienceId: "audience-1",
      percentage: 1,
    });

    const rows = await repo.listByTenant("dss-motor");
    expect(rows).toHaveLength(2);
    const lookalike = rows.find((row) => row.audienceType === "LOOKALIKE_1PCT");
    expect(lookalike?.originAudienceId).toBe("audience-1");
    expect(lookalike?.percentage).toBe(1);
  });

  it("updateSize persists the new size and lastUpdatedAt", async () => {
    const repo = new MetaAudienceRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.updateSize(created.id, 42, "2026-08-21T02:00:00.000Z");

    const found = await repo.findByTenantAndType("dss-motor", "HOT_LEADS");
    expect(found?.size).toBe(42);
    expect(found?.lastUpdatedAt).toBe("2026-08-21T02:00:00.000Z");
  });
});
