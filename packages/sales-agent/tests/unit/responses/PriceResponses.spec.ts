import { InventoryUnitBuilder, UnitTransmission } from "@aos/dss-inventory-connector";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { dpInfoPool, getDpInfoResponse } from "../../../src/responses/PriceResponses.js";
import { unwrap } from "../../helpers/result.js";

function unit() {
  return unwrap(
    new InventoryUnitBuilder()
      .withBrand("Mitsubishi")
      .withModel("Xpander Cross")
      .withYear(2019)
      .withTransmission(UnitTransmission.AT)
      .withColor("Putih")
      .withKilometer(45_000)
      .withPrice(195_000_000)
      .withBranch(Branch.BINTARO)
      .build(),
  );
}

describe("PriceResponses", () => {
  it("dpInfoPool() has 1 entry, ≤ 300 chars", () => {
    const pool = dpInfoPool(unit());
    expect(pool).toHaveLength(1);
    expect(pool[0]!.length).toBeLessThanOrEqual(300);
  });

  it("getDpInfoResponse() reports the exact pinned DP (29.000.000)", () => {
    const text = getDpInfoResponse(unit(), 0);
    expect(text).toContain("29.000.000");
  });

  it("getDpInfoResponse() reports the estimatedMonthly within ± 100,000 of the pinned 5,447,333", () => {
    const found = unit();
    expect(found.estimatedMonthly.toNumber()).toBeGreaterThanOrEqual(5_447_333 - 100_000);
    expect(found.estimatedMonthly.toNumber()).toBeLessThanOrEqual(5_447_333 + 100_000);
    const text = getDpInfoResponse(found, 0);
    expect(text).toContain(found.estimatedMonthly.toNumber().toLocaleString("id-ID"));
  });
});
