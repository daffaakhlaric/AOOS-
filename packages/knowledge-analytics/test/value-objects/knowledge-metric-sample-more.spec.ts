import { describe, expect, it } from "vitest";

import { KnowledgeMetricSample } from "../../src/value-objects/knowledge-metric-sample.js";

describe("KnowledgeMetricSample additional coverage", () => {
  it("accepts a very large finite value", () => {
    expect(
      () => new KnowledgeMetricSample({ name: "x", value: Number.MAX_SAFE_INTEGER, timestamp: 0 }),
    ).not.toThrow();
  });

  it("accepts a timestamp of exactly 0", () => {
    expect(() => new KnowledgeMetricSample({ name: "x", value: 1, timestamp: 0 })).not.toThrow();
  });

  it("accepts multi-key tags", () => {
    const sample = new KnowledgeMetricSample({
      name: "x",
      value: 1,
      timestamp: 0,
      tags: { a: "1", b: "2", c: "3" },
    });
    expect(Object.keys(sample.tags)).toHaveLength(3);
  });

  it("withTags called with an empty object returns an equivalent sample", () => {
    const original = new KnowledgeMetricSample({
      name: "x",
      value: 1,
      timestamp: 0,
      tags: { a: "1" },
    });
    const updated = original.withTags({});
    expect(updated.tags).toEqual({ a: "1" });
  });

  it("withTags returns a distinct object identity from the original", () => {
    const original = new KnowledgeMetricSample({ name: "x", value: 1, timestamp: 0 });
    expect(original.withTags({ a: "1" })).not.toBe(original);
  });

  it("two samples with identical properties are not the same identity (value objects compare by structure, not reference)", () => {
    const a = new KnowledgeMetricSample({ name: "x", value: 1, timestamp: 0 });
    const b = new KnowledgeMetricSample({ name: "x", value: 1, timestamp: 0 });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
