import { describe, expect, it } from "vitest";

import { formatKm, formatPrice } from "../../../src/responses/formatters.js";

describe("formatters", () => {
  it("formatPrice() formats with Indonesian thousand separators", () => {
    expect(formatPrice(195_000_000)).toBe("195.000.000");
  });

  it("formatPrice() rounds a fractional amount", () => {
    expect(formatPrice(1_000.6)).toBe("1.001");
  });

  it("formatKm() formats with Indonesian thousand separators", () => {
    expect(formatKm(45_000)).toBe("45.000");
  });

  it("formatKm() rounds a fractional value", () => {
    expect(formatKm(1_000.4)).toBe("1.000");
  });
});
