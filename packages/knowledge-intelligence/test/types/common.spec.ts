import { describe, expect, it } from "vitest";

import type { Metadata, ThresholdBand, WeightedSignal } from "../../src/types/common.js";

describe("common types", () => {
  it("Metadata accepts a readonly string-keyed record", () => {
    const metadata: Metadata = { a: 1, b: "two" };
    expect(metadata.a).toBe(1);
  });

  it("WeightedSignal shape is usable as a plain object literal", () => {
    const signal: WeightedSignal = { name: "x", value: 50, weight: 1 };
    expect(signal.value).toBe(50);
  });

  it("ThresholdBand shape is usable as a plain object literal", () => {
    const band: ThresholdBand = { label: "healthy", min: 80 };
    expect(band.label).toBe("healthy");
  });
});
