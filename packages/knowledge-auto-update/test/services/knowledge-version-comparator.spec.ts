import { describe, expect, it } from "vitest";

import { KnowledgeVersionComparator } from "../../src/services/knowledge-version-comparator.js";

describe("KnowledgeVersionComparator", () => {
  const comparator = new KnowledgeVersionComparator();

  it("compare delegates to the underlying comparator", () => {
    expect(comparator.compare("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  it("isNewer returns true for a strictly newer version", () => {
    expect(comparator.isNewer("2.0.0", "1.0.0")).toBe(true);
    expect(comparator.isNewer("1.0.0", "2.0.0")).toBe(false);
    expect(comparator.isNewer("1.0.0", "1.0.0")).toBe(false);
  });

  it("isCompatible returns true within an inclusive range", () => {
    expect(comparator.isCompatible("1.5.0", "1.0.0", "2.0.0")).toBe(true);
    expect(comparator.isCompatible("1.0.0", "1.0.0", "2.0.0")).toBe(true);
    expect(comparator.isCompatible("2.0.0", "1.0.0", "2.0.0")).toBe(true);
  });

  it("isCompatible returns false outside the range", () => {
    expect(comparator.isCompatible("0.9.0", "1.0.0", "2.0.0")).toBe(false);
    expect(comparator.isCompatible("2.0.1", "1.0.0", "2.0.0")).toBe(false);
  });

  it("isValid delegates to isValidVersion", () => {
    expect(comparator.isValid("1.0.0")).toBe(true);
    expect(comparator.isValid("nope")).toBe(false);
  });

  it("compare returns 0 for equal versions via the service wrapper", () => {
    expect(comparator.compare("2.2.2", "2.2.2")).toBe(0);
  });

  it("isCompatible is inclusive at both boundaries via the service wrapper", () => {
    expect(comparator.isCompatible("5.0.0", "5.0.0", "5.0.0")).toBe(true);
  });
});
