import { InventoryUnitBuilder, UnitTransmission } from "@aos/dss-inventory-connector";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import {
  getUnitFoundResponse,
  getUnitNotFoundResponse,
  unitFoundPool,
} from "../../../src/responses/UnitResponses.js";
import { unwrap } from "../../helpers/result.js";

function unit() {
  return unwrap(
    new InventoryUnitBuilder()
      .withBrand("Honda")
      .withModel("Brio RS")
      .withYear(2021)
      .withTransmission(UnitTransmission.AT)
      .withColor("Merah")
      .withKilometer(22_000)
      .withPrice(158_000_000)
      .withBranch(Branch.BINTARO)
      .build(),
  );
}

describe("UnitResponses", () => {
  it("unitFoundPool() has 2 variants, each ≤ 300 chars", () => {
    const pool = unitFoundPool(unit());
    expect(pool).toHaveLength(2);
    for (const entry of pool) {
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });

  it("getUnitFoundResponse() includes real price and km", () => {
    const text = getUnitFoundResponse(unit(), 0);
    expect(text).toContain("158.000.000");
    expect(text).toContain("22.000");
  });

  it("getUnitNotFoundResponse() without an alternative branch", () => {
    const text = getUnitNotFoundResponse("Rush", "Mobix Bintaro");
    expect(text).toContain("Rush");
    expect(text).toContain("Mobix Bintaro");
    expect(text).not.toContain("tapi di");
  });

  it("getUnitNotFoundResponse() with an alternative branch suggestion", () => {
    const text = getUnitNotFoundResponse("Rush", "Mobix Bintaro", "Mobix Cinere");
    expect(text).toContain("Mobix Cinere");
    expect(text).toContain("tapi di");
  });
});
