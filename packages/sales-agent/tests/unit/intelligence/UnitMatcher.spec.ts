import { InventoryUnitBuilder, UnitTransmission } from "@aos/dss-inventory-connector";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { UnitMatcher } from "../../../src/intelligence/UnitMatcher.js";
import { unwrap } from "../../helpers/result.js";

function make(model: string, price: number, transmission = UnitTransmission.AT) {
  return unwrap(
    new InventoryUnitBuilder()
      .withModel(model)
      .withPrice(price)
      .withTransmission(transmission)
      .withBranch(Branch.CINERE)
      .build(),
  );
}

describe("UnitMatcher", () => {
  it("match: model + price range", () => {
    const units = [make("Xpander Cross", 195_000_000), make("Brio RS", 158_000_000)];
    const result = UnitMatcher.match(units, { model: "Brio", maxPrice: 160_000_000 });
    expect(result).toHaveLength(1);
    expect(result[0]!.model.toString()).toBe("Brio RS");
  });

  it("partial match: model only → returns all units of that model", () => {
    const units = [
      make("Xpander Cross", 195_000_000),
      make("Xpander Ultimate", 238_000_000),
      make("Brio RS", 158_000_000),
    ];
    const result = UnitMatcher.match(units, { model: "Xpander" });
    expect(result).toHaveLength(2);
  });

  it("no match → empty array", () => {
    const units = [make("Xpander Cross", 195_000_000)];
    const result = UnitMatcher.match(units, { model: "Rush" });
    expect(result).toEqual([]);
  });

  it("filters by transmission", () => {
    const units = [
      make("Brio Satya", 118_000_000, UnitTransmission.MT),
      make("Brio RS", 158_000_000, UnitTransmission.AT),
    ];
    const result = UnitMatcher.match(units, { transmission: "AT" });
    expect(result).toHaveLength(1);
    expect(result[0]!.transmission).toBe("AT");
  });

  it("no criteria at all → returns every unit unchanged", () => {
    const units = [make("Xpander Cross", 195_000_000), make("Brio RS", 158_000_000)];
    expect(UnitMatcher.match(units, {})).toHaveLength(2);
  });

  it("model matching is case-insensitive", () => {
    const units = [make("Xpander Cross", 195_000_000)];
    expect(UnitMatcher.match(units, { model: "xpander" })).toHaveLength(1);
  });

  it("an empty-string model criterion matches everything", () => {
    const units = [make("Xpander Cross", 195_000_000), make("Brio RS", 158_000_000)];
    expect(UnitMatcher.match(units, { model: "" })).toHaveLength(2);
  });
});
