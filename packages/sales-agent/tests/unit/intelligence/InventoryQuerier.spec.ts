import { BranchId } from "@aos/branch-manager";
import type { IInventoryQueryService } from "@aos/dss-inventory-connector";
import { beforeEach, describe, expect, it } from "vitest";

import { InventoryQuerier } from "../../../src/intelligence/InventoryQuerier.js";
import { makeRealSyncedInventoryQueryService } from "../../fixtures/salesAgentFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("InventoryQuerier (real @aos/dss-inventory-connector data)", () => {
  let querier: InventoryQuerier;

  beforeEach(async () => {
    querier = new InventoryQuerier(await makeRealSyncedInventoryQueryService());
  });

  it('"Xpander Cinere" → returns the Cinere Xpander units (MOCK-CIN-001 + MOCK-CIN-002)', async () => {
    const result = unwrap(await querier.findForLead({ branch: BranchId.CINERE, model: "Xpander" }));
    expect(result).toHaveLength(2);
    expect(result.every((u) => u.model.toString().toLowerCase().includes("xpander"))).toBe(true);
  });

  it('"Brio budget 150 juta" → returns Brio ≤ 150jt (empty in Cinere: only Brio Satya 118jt qualifies)', async () => {
    const result = unwrap(
      await querier.findForLead({ branch: BranchId.CINERE, model: "Brio", maxPrice: 150_000_000 }),
    );
    expect(result.every((u) => u.price.toNumber() <= 150_000_000)).toBe(true);
    expect(result.some((u) => u.model.toString().includes("Brio"))).toBe(true);
  });

  it("branch=BINTARO, maxPrice=160jt → returns only MOCK-BIN-003 (Brio 158jt), excluding the RESERVED cheaper Avanza", async () => {
    const result = unwrap(
      await querier.findForLead({ branch: BranchId.BINTARO, maxPrice: 160_000_000 }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.price.toNumber()).toBe(158_000_000);
    expect(result[0]!.model.toString()).toContain("Brio");
  });

  it("no match in a branch → returns an empty array (not an error)", async () => {
    const result = unwrap(await querier.findForLead({ branch: BranchId.UMUM, model: "Stargazer" }));
    expect(result).toEqual([]);
  });

  it("only ever returns AVAILABLE units, never RESERVED or SOLD", async () => {
    const all = unwrap(await querier.findForLead({ branch: BranchId.BINTARO }));
    expect(all.every((u) => u.status === "AVAILABLE")).toBe(true);
    // The RESERVED Avanza Veloz must never appear even without a price cap.
    expect(all.some((u) => u.model.toString().includes("Avanza"))).toBe(false);
  });

  it("findAlternative() finds a cross-branch match when the lead's own branch has none", async () => {
    const alt = querier.findAlternative({ model: "Rush" });
    expect(alt.length).toBeGreaterThan(0);
    expect(alt[0]!.model.toString()).toContain("Rush");
  });

  it("findAlternative() returns an empty array when no branch has a match", async () => {
    const alt = querier.findAlternative({ model: "Nonexistent Model XYZ" });
    expect(alt).toEqual([]);
  });

  it("findForLead() returns an AgentError when the underlying query service throws", async () => {
    const throwingQueryService = {
      getAvailableByBranch: () => {
        throw new Error("store unavailable");
      },
    } as unknown as IInventoryQueryService;
    const throwingQuerier = new InventoryQuerier(throwingQueryService);
    const result = await throwingQuerier.findForLead({ branch: BranchId.CINERE });
    expect(unwrapErr(result).message).toContain("InventoryQuerier.findForLead failed");
  });
});
