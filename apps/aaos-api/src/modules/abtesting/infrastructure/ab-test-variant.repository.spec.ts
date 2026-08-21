import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  AbTestVariantRepository,
  AbTestVariantRepositoryError,
  type CreateAbTestVariantInput,
} from "./ab-test-variant.repository.js";

const BASE_INPUT: CreateAbTestVariantInput = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  abTestId: "test-1",
  tenantId: "dss-motor",
  variantLabel: "A",
  angle: "DP_RINGAN",
  creativePackageId: "pkg-1",
};

describe("AbTestVariantRepository", () => {
  it("create persists a PENDING_CREATIVE variant with zeroed insights", async () => {
    const repo = new AbTestVariantRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);

    expect(created.status).toBe("PENDING_CREATIVE");
    expect(created.spend).toBe(0);
    expect(created.leads).toBe(0);
    expect(created.metaAdId).toBeUndefined();
  });

  it("listByAbTest returns only that test's variants, ordered by label", async () => {
    const repo = new AbTestVariantRepository(createFakeSupabaseClient());
    await repo.create({ ...BASE_INPUT, id: "b", variantLabel: "B" });
    await repo.create({ ...BASE_INPUT, id: "a", variantLabel: "A" });
    await repo.create({ ...BASE_INPUT, id: "other", abTestId: "test-2", variantLabel: "A" });

    const found = await repo.listByAbTest("test-1");
    expect(found.map((v) => v.variantLabel)).toEqual(["A", "B"]);
  });

  it("markLaunched sets meta_ad_id and flips status to RUNNING", async () => {
    const repo = new AbTestVariantRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markLaunched(created.id, "ad-123");

    const [found] = await repo.listByAbTest(created.abTestId);
    expect(found?.metaAdId).toBe("ad-123");
    expect(found?.status).toBe("RUNNING");
  });

  it("updateInsights persists real pulled metrics", async () => {
    const repo = new AbTestVariantRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.updateInsights(created.id, {
      spend: 52_000,
      impressions: 12_400,
      clicks: 260,
      conversations: 10,
      leads: 6,
      rphLead: 8_667,
      ctr: 0.021,
      lastSyncedAtIso: "2026-08-19T12:00:00.000Z",
    });

    const [found] = await repo.listByAbTest(created.abTestId);
    expect(found?.spend).toBe(52_000);
    expect(found?.rphLead).toBe(8_667);
    expect(found?.ctr).toBeCloseTo(0.021);
  });

  it("markStatus updates the status column", async () => {
    const repo = new AbTestVariantRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markStatus(created.id, "READY");
    const [found] = await repo.listByAbTest(created.abTestId);
    expect(found?.status).toBe("READY");
  });

  it("surfaces a real repository error when the underlying client errors", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("ab_test_variants", "connection reset");
    const repo = new AbTestVariantRepository(client);
    await expect(repo.create(BASE_INPUT)).rejects.toBeInstanceOf(AbTestVariantRepositoryError);
  });
});
