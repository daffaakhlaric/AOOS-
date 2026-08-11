import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { GetClosingStats } from "../../../src/application/use-cases/GetClosingStats.js";
import { ClosingRepository } from "../../../src/infrastructure/supabase/ClosingRepository.js";
import { makeClosingRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

const FROM = new Date("2026-01-01T00:00:00.000Z");
const TO = new Date("2026-01-31T23:59:59.000Z");

/** A hand-rolled `ISpendProvider` mock matching the real interface (design resolution #3). */
function makeSpendProvider(spendByCampaign: Record<string, number>) {
  return {
    getSpendByCampaign: async (campaignIds: readonly string[]) =>
      new Map(campaignIds.map((id) => [id, spendByCampaign[id] ?? 0])),
  };
}

describe("GetClosingStats — rphSpkByCampaign (pinned example, design resolution #3)", () => {
  it("campaign #C047: spend=564000, closings=3 -> rphSpk=188000", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ campaign_id: "#C047", created_at: "2026-01-10T00:00:00.000Z" }),
      makeClosingRow({ campaign_id: "#C047", created_at: "2026-01-11T00:00:00.000Z" }),
      makeClosingRow({ campaign_id: "#C047", created_at: "2026-01-12T00:00:00.000Z" }),
    ]);
    const useCase = new GetClosingStats(
      new ClosingRepository(client),
      makeSpendProvider({ "#C047": 564_000 }),
    );
    const stats = unwrap(await useCase.execute({ fromDate: FROM, toDate: TO }));
    expect(stats.closingsByCampaign["#C047"]).toBe(3);
    expect(stats.rphSpkByCampaign["#C047"]).toBe(188_000);
  });

  it("a campaign with 0 closings produces no rphSpk entry (divide-by-zero guard)", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetClosingStats(
      new ClosingRepository(client),
      makeSpendProvider({ "#C999": 100_000 }),
    );
    const stats = unwrap(await useCase.execute({ fromDate: FROM, toDate: TO }));
    expect(stats.rphSpkByCampaign["#C999"]).toBeUndefined();
    expect(Number.isNaN(stats.rphSpkByCampaign["#C999"])).toBe(false);
  });

  it("a campaign with spend=0 produces rphSpk=0, not NaN", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ campaign_id: "#C000", created_at: "2026-01-10T00:00:00.000Z" }),
    ]);
    const useCase = new GetClosingStats(new ClosingRepository(client), makeSpendProvider({}));
    const stats = unwrap(await useCase.execute({ fromDate: FROM, toDate: TO }));
    expect(stats.rphSpkByCampaign["#C000"]).toBe(0);
  });
});

describe("GetClosingStats — aggregates", () => {
  it("computes totalClosings, totalCommissionIdr, avgCommissionIdr", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ commission_idr: 1_000_000, created_at: "2026-01-10T00:00:00.000Z" }),
      makeClosingRow({ commission_idr: 3_000_000, created_at: "2026-01-11T00:00:00.000Z" }),
    ]);
    const useCase = new GetClosingStats(new ClosingRepository(client), makeSpendProvider({}));
    const stats = unwrap(await useCase.execute({ fromDate: FROM, toDate: TO }));
    expect(stats.totalClosings).toBe(2);
    expect(stats.totalCommissionIdr).toBe(4_000_000);
    expect(stats.avgCommissionIdr).toBe(2_000_000);
  });

  it("avgCommissionIdr is 0 when there are no closings", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetClosingStats(new ClosingRepository(client), makeSpendProvider({}));
    const stats = unwrap(await useCase.execute({ fromDate: FROM, toDate: TO }));
    expect(stats.totalClosings).toBe(0);
    expect(stats.avgCommissionIdr).toBe(0);
  });

  it("groups closingsByBranch correctly", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ branch_id: BranchId.BINTARO, created_at: "2026-01-10T00:00:00.000Z" }),
      makeClosingRow({ branch_id: BranchId.BINTARO, created_at: "2026-01-11T00:00:00.000Z" }),
      makeClosingRow({ branch_id: BranchId.CINERE, created_at: "2026-01-12T00:00:00.000Z" }),
    ]);
    const useCase = new GetClosingStats(new ClosingRepository(client), makeSpendProvider({}));
    const stats = unwrap(await useCase.execute({ fromDate: FROM, toDate: TO }));
    expect(stats.closingsByBranch[BranchId.BINTARO]).toBe(2);
    expect(stats.closingsByBranch[BranchId.CINERE]).toBe(1);
  });

  it("filtered by date range excludes out-of-range closings", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ created_at: "2026-01-10T00:00:00.000Z" }),
      makeClosingRow({ created_at: "2026-06-01T00:00:00.000Z" }),
    ]);
    const useCase = new GetClosingStats(new ClosingRepository(client), makeSpendProvider({}));
    const stats = unwrap(await useCase.execute({ fromDate: FROM, toDate: TO }));
    expect(stats.totalClosings).toBe(1);
  });

  it("filtered by branch", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ branch_id: BranchId.BINTARO, created_at: "2026-01-10T00:00:00.000Z" }),
      makeClosingRow({ branch_id: BranchId.CINERE, created_at: "2026-01-11T00:00:00.000Z" }),
    ]);
    const useCase = new GetClosingStats(new ClosingRepository(client), makeSpendProvider({}));
    const stats = unwrap(
      await useCase.execute({ branchId: BranchId.BINTARO, fromDate: FROM, toDate: TO }),
    );
    expect(stats.totalClosings).toBe(1);
  });

  it("surfaces a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("closings", "timeout");
    const useCase = new GetClosingStats(new ClosingRepository(client), makeSpendProvider({}));
    const error = unwrapErr(await useCase.execute({ fromDate: FROM, toDate: TO }));
    expect(error.message).toContain("timeout");
  });

  it("rejects fromDate after toDate", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetClosingStats(new ClosingRepository(client), makeSpendProvider({}));
    const error = unwrapErr(await useCase.execute({ fromDate: TO, toDate: FROM }));
    expect(error.message).toContain("fromDate");
  });
});
