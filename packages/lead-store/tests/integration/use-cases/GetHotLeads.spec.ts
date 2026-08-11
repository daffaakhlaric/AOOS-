import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { GetHotLeads } from "../../../src/application/use-cases/GetHotLeads.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetHotLeads", () => {
  it("returns only status=HOT leads for the correct branch", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({
        branch_id: BranchId.BINTARO,
        status: "HOT",
        became_hot_at: "2026-01-15T09:00:00.000Z",
      }),
      makeLeadRow({ branch_id: BranchId.BINTARO, status: "WARM" }),
      makeLeadRow({
        branch_id: BranchId.CINERE,
        status: "HOT",
        became_hot_at: "2026-01-15T09:00:00.000Z",
      }),
    ]);
    const useCase = new GetHotLeads(new LeadRepository(client));
    const result = unwrap(await useCase.execute(BranchId.BINTARO));
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("HOT");
  });

  it("surfaces a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("leads", "db down");
    const useCase = new GetHotLeads(new LeadRepository(client));
    const result = await useCase.execute(BranchId.BINTARO);
    expect(result.ok).toBe(false);
  });

  it("orders results by becameHotAt DESC", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({
        branch_id: BranchId.BINTARO,
        status: "HOT",
        became_hot_at: "2026-01-15T08:00:00.000Z",
        lead_name: "older",
      }),
      makeLeadRow({
        branch_id: BranchId.BINTARO,
        status: "HOT",
        became_hot_at: "2026-01-15T10:00:00.000Z",
        lead_name: "newer",
      }),
    ]);
    const useCase = new GetHotLeads(new LeadRepository(client));
    const result = unwrap(await useCase.execute(BranchId.BINTARO));
    expect(result[0]?.leadName).toBe("newer");
    expect(result[1]?.leadName).toBe("older");
  });

  it("treats a missing becameHotAt as oldest when sorting", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({
        branch_id: BranchId.BINTARO,
        status: "HOT",
        became_hot_at: null,
        lead_name: "no-timestamp",
      }),
      makeLeadRow({
        branch_id: BranchId.BINTARO,
        status: "HOT",
        became_hot_at: "2026-01-15T10:00:00.000Z",
        lead_name: "has-timestamp",
      }),
    ]);
    const useCase = new GetHotLeads(new LeadRepository(client));
    const result = unwrap(await useCase.execute(BranchId.BINTARO));
    expect(result[0]?.leadName).toBe("has-timestamp");
    expect(result[1]?.leadName).toBe("no-timestamp");
  });
});
