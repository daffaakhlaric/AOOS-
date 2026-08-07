import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { KnowledgeMetricSample } from "../../src/value-objects/knowledge-metric-sample.js";

describe("KnowledgeMetricSample", () => {
  it("stores name, value, timestamp", () => {
    const sample = new KnowledgeMetricSample({ name: "search_count", value: 1, timestamp: 100 });
    expect(sample.name).toBe("search_count");
    expect(sample.value).toBe(1);
    expect(sample.timestamp).toBe(100);
  });

  it("defaults tags to an empty object", () => {
    const sample = new KnowledgeMetricSample({ name: "x", value: 1, timestamp: 0 });
    expect(sample.tags).toEqual({});
  });

  it("stores supplied tags", () => {
    const sample = new KnowledgeMetricSample({
      name: "x",
      value: 1,
      timestamp: 0,
      tags: { provider: "openai" },
    });
    expect(sample.tags).toEqual({ provider: "openai" });
  });

  it("is frozen (immutable)", () => {
    const sample = new KnowledgeMetricSample({ name: "x", value: 1, timestamp: 0 });
    expect(Object.isFrozen(sample)).toBe(true);
  });

  it("freezes the tags object", () => {
    const sample = new KnowledgeMetricSample({
      name: "x",
      value: 1,
      timestamp: 0,
      tags: { a: "b" },
    });
    expect(Object.isFrozen(sample.tags)).toBe(true);
  });

  it("throws InvalidSampleException for an empty name", () => {
    expect(() => new KnowledgeMetricSample({ name: "", value: 1, timestamp: 0 })).toThrow(
      InvalidSampleException,
    );
  });

  it("throws InvalidSampleException for a whitespace-only name", () => {
    expect(() => new KnowledgeMetricSample({ name: "   ", value: 1, timestamp: 0 })).toThrow(
      InvalidSampleException,
    );
  });

  it("throws InvalidSampleException for a non-finite value", () => {
    expect(() => new KnowledgeMetricSample({ name: "x", value: Number.NaN, timestamp: 0 })).toThrow(
      InvalidSampleException,
    );
    expect(() => new KnowledgeMetricSample({ name: "x", value: Infinity, timestamp: 0 })).toThrow(
      InvalidSampleException,
    );
  });

  it("throws InvalidSampleException for a negative timestamp", () => {
    expect(() => new KnowledgeMetricSample({ name: "x", value: 1, timestamp: -1 })).toThrow(
      InvalidSampleException,
    );
  });

  it("throws InvalidSampleException for a non-finite timestamp", () => {
    expect(() => new KnowledgeMetricSample({ name: "x", value: 1, timestamp: Number.NaN })).toThrow(
      InvalidSampleException,
    );
  });

  it("accepts a zero value", () => {
    expect(() => new KnowledgeMetricSample({ name: "x", value: 0, timestamp: 0 })).not.toThrow();
  });

  it("accepts a negative value (e.g. a delta)", () => {
    expect(() => new KnowledgeMetricSample({ name: "x", value: -5, timestamp: 0 })).not.toThrow();
  });

  describe("withTags", () => {
    it("returns a new instance with tags merged over the existing ones", () => {
      const original = new KnowledgeMetricSample({
        name: "x",
        value: 1,
        timestamp: 0,
        tags: { a: "1" },
      });
      const updated = original.withTags({ b: "2" });
      expect(updated.tags).toEqual({ a: "1", b: "2" });
      expect(original.tags).toEqual({ a: "1" });
    });

    it("overwrites an existing tag key", () => {
      const original = new KnowledgeMetricSample({
        name: "x",
        value: 1,
        timestamp: 0,
        tags: { a: "1" },
      });
      const updated = original.withTags({ a: "2" });
      expect(updated.tags).toEqual({ a: "2" });
    });

    it("does not mutate the original instance", () => {
      const original = new KnowledgeMetricSample({ name: "x", value: 1, timestamp: 0 });
      original.withTags({ a: "1" });
      expect(original.tags).toEqual({});
    });

    it("preserves name/value/timestamp", () => {
      const original = new KnowledgeMetricSample({ name: "x", value: 42, timestamp: 99 });
      const updated = original.withTags({ a: "1" });
      expect(updated.name).toBe("x");
      expect(updated.value).toBe(42);
      expect(updated.timestamp).toBe(99);
    });
  });
});
