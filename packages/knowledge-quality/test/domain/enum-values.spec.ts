import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import { KnowledgeQualitySessionState } from "../../src/domain/knowledge-quality-session-state.js";
import { KnowledgeQualityEventType } from "../../src/events/knowledge-quality-event-type.js";
import { KnowledgeQualityRegistryBucket } from "../../src/registry/knowledge-quality-registry-bucket.js";

describe("Knowledge Types — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeQualityDimension))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeQualityDimension);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("Assessment Modes — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeQualityAssessmentMode))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeQualityAssessmentMode);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("Lifecycle states — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeQualityAssessmentState))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeQualityAssessmentState);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("KnowledgeQualitySessionState — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeQualitySessionState))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });
});

describe("KnowledgeQualityRegistryBucket — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeQualityRegistryBucket))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeQualityRegistryBucket);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("KnowledgeQualityEventType — every named value follows the knowledge.quality.* dotted convention", () => {
  it.each(Object.entries(KnowledgeQualityEventType))("%s -> %s", (_key, value) => {
    expect(value.startsWith("knowledge.quality.")).toBe(true);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeQualityEventType);
    expect(new Set(values).size).toBe(values.length);
  });
});
