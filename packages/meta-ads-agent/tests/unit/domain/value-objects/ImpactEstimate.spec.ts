import { describe, expect, it } from "vitest";

import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";

describe("ImpactEstimate", () => {
  it("creates with just a description", () => {
    const result = ImpactEstimate.create({ description: "hemat Rp 1.2 juta" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.description).toBe("hemat Rp 1.2 juta");
    expect(result.ok && result.value.amountIDR).toBeUndefined();
  });

  it("creates with a description and amountIDR", () => {
    const result = ImpactEstimate.create({ description: "hemat", amountIDR: 1_200_000 });
    expect(result.ok && result.value.amountIDR).toBe(1_200_000);
  });

  it("rejects an empty description", () => {
    expect(ImpactEstimate.create({ description: "" }).ok).toBe(false);
  });

  it("rejects a non-integer amountIDR", () => {
    expect(ImpactEstimate.create({ description: "x", amountIDR: 1.5 }).ok).toBe(false);
  });

  it("rejects a non-finite amountIDR", () => {
    expect(ImpactEstimate.create({ description: "x", amountIDR: Number.NaN }).ok).toBe(false);
  });
});
