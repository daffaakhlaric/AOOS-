import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  AbTestRepository,
  AbTestRepositoryError,
  type CreateAbTestInput,
} from "./ab-test.repository.js";

const BASE_INPUT: CreateAbTestInput = {
  id: "11111111-1111-1111-1111-111111111111",
  tenantId: "dss-motor",
  name: "Xpander Cinere — DP vs Stok",
  campaignId: "camp-1",
  adSetId: "adset-1",
  pageId: "page-1",
  waLink: "https://wa.me/6281234567890",
  mode: "AUTO",
  thresholdSpend: 100_000,
  thresholdDays: 3,
  minMarginPct: 20,
  autoPauseLoser: true,
  autoScaleWinner: true,
};

describe("AbTestRepository", () => {
  it("create persists a DRAFT test with no winner set", async () => {
    const repo = new AbTestRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);

    expect(created.id).toBe(BASE_INPUT.id);
    expect(created.status).toBe("DRAFT");
    expect(created.waLink).toBe(BASE_INPUT.waLink);
    expect(created.winnerVariantId).toBeUndefined();
  });

  it("findById returns undefined for a different tenant", async () => {
    const repo = new AbTestRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    expect(await repo.findById("other-tenant", BASE_INPUT.id)).toBeUndefined();
  });

  it("findById returns the stored test", async () => {
    const repo = new AbTestRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    const found = await repo.findById("dss-motor", BASE_INPUT.id);
    expect(found?.name).toBe(BASE_INPUT.name);
  });

  it("listByStatus filters by status", async () => {
    const repo = new AbTestRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markRunning(created.id, "2026-08-19T06:00:00.000Z");

    const running = await repo.listByStatus("dss-motor", "RUNNING");
    expect(running).toHaveLength(1);
    const drafts = await repo.listByStatus("dss-motor", "DRAFT");
    expect(drafts).toHaveLength(0);
  });

  it("listByCampaign returns every test for a campaign regardless of status", async () => {
    const repo = new AbTestRepository(createFakeSupabaseClient());
    await repo.create(BASE_INPUT);
    await repo.create({ ...BASE_INPUT, id: "22222222-2222-2222-2222-222222222222" });
    await repo.create({
      ...BASE_INPUT,
      id: "33333333-3333-3333-3333-333333333333",
      campaignId: "other",
    });

    const found = await repo.listByCampaign("dss-motor", "camp-1");
    expect(found).toHaveLength(2);
  });

  it("markFailed sets status FAILED and the reason", async () => {
    const repo = new AbTestRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markFailed(created.id, "creative gagal");
    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("FAILED");
    expect(found?.failedReason).toBe("creative gagal");
  });

  it("markComplete sets winner fields and completion timestamp", async () => {
    const repo = new AbTestRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markRunning(created.id, "2026-08-19T06:00:00.000Z");
    await repo.markComplete(created.id, "variant-a", 8_667, 28, "2026-08-22T06:00:00.000Z");

    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("COMPLETE");
    expect(found?.winnerVariantId).toBe("variant-a");
    expect(found?.winnerRphLead).toBe(8_667);
    expect(found?.improvementPct).toBe(28);
  });

  it("surfaces a real repository error when the underlying client errors", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("ab_tests", "connection reset");
    const repo = new AbTestRepository(client);
    await expect(repo.create(BASE_INPUT)).rejects.toBeInstanceOf(AbTestRepositoryError);
  });
});
