import { describe, expect, it } from "vitest";

import { KnowledgeMetricSampleFactory } from "../../src/factories/knowledge-metric-sample-factory.js";
import { createFixedClock } from "../../src/utils/clock.js";

describe("KnowledgeMetricSampleFactory", () => {
  it("creates a sample with the given name/value/tags", () => {
    const factory = new KnowledgeMetricSampleFactory(createFixedClock(1000));
    const sample = factory.create({ name: "x", value: 5, tags: { a: "1" } });
    expect(sample.name).toBe("x");
    expect(sample.value).toBe(5);
    expect(sample.tags).toEqual({ a: "1" });
  });

  it("uses the injected clock when no timestamp is supplied", () => {
    const factory = new KnowledgeMetricSampleFactory(createFixedClock(999));
    expect(factory.create({ name: "x", value: 1 }).timestamp).toBe(999);
  });

  it("uses a supplied timestamp verbatim", () => {
    const factory = new KnowledgeMetricSampleFactory(createFixedClock(999));
    expect(factory.create({ name: "x", value: 1, timestamp: 42 }).timestamp).toBe(42);
  });

  it("defaults tags to an empty object", () => {
    const factory = new KnowledgeMetricSampleFactory();
    expect(factory.create({ name: "x", value: 1 }).tags).toEqual({});
  });

  it("defaults to the system clock when none is injected", () => {
    const factory = new KnowledgeMetricSampleFactory();
    const before = Date.now();
    const sample = factory.create({ name: "x", value: 1 });
    expect(sample.timestamp).toBeGreaterThanOrEqual(before);
  });
});
