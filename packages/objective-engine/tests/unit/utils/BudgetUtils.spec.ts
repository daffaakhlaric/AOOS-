import { describe, expect, it } from "vitest";

import { budgetUsedFraction, formatIDR } from "../../../src/utils/BudgetUtils.js";

describe("formatIDR", () => {
  it("formats with Indonesian thousands separators", () => {
    expect(formatIDR(30_000_000)).toBe("Rp 30.000.000");
  });

  it("formats a small amount without separators", () => {
    expect(formatIDR(500)).toBe("Rp 500");
  });

  it("formats zero", () => {
    expect(formatIDR(0)).toBe("Rp 0");
  });

  it("formats a negative amount with a leading minus sign", () => {
    expect(formatIDR(-1_000)).toBe("-Rp 1.000");
  });

  it("rounds fractional amounts", () => {
    expect(formatIDR(1_000.6)).toBe("Rp 1.001");
  });
});

describe("budgetUsedFraction", () => {
  it("computes the used fraction", () => {
    expect(budgetUsedFraction(15_000_000, 30_000_000)).toBe(0.5);
  });

  it("returns 0 when budgetAllocation is 0 (division-by-zero safety)", () => {
    expect(budgetUsedFraction(1_000_000, 0)).toBe(0);
  });

  it("returns 0 when budgetAllocation is negative", () => {
    expect(budgetUsedFraction(1_000_000, -1)).toBe(0);
  });

  it("clamps at 1 when currentSpend exceeds budgetAllocation", () => {
    expect(budgetUsedFraction(40_000_000, 30_000_000)).toBe(1);
  });

  it("returns 0 for 0 spend", () => {
    expect(budgetUsedFraction(0, 30_000_000)).toBe(0);
  });
});
