import { describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import { KnowledgeGeneratorSessionState } from "../../src/domain/knowledge-generator-session-state.js";
import { KnowledgeGeneratorEventType } from "../../src/events/knowledge-generator-event-type.js";
import { KnowledgeGeneratorRegistryBucket } from "../../src/registry/knowledge-generator-registry-bucket.js";

describe("Knowledge Types — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeGenerationAssetType))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeGenerationAssetType);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("Generation Providers — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeGenerationProviderType))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeGenerationProviderType);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("Generation Modes — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeGenerationMode))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeGenerationMode);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("Lifecycle states — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeGenerationState))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeGenerationState);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("KnowledgeGeneratorSessionState — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeGeneratorSessionState))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });
});

describe("KnowledgeGeneratorRegistryBucket — every named value is a distinct non-empty string", () => {
  it.each(Object.entries(KnowledgeGeneratorRegistryBucket))("%s -> %s", (_key, value) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeGeneratorRegistryBucket);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("KnowledgeGeneratorEventType — every named value follows the knowledge.generation.* dotted convention", () => {
  it.each(Object.entries(KnowledgeGeneratorEventType))("%s -> %s", (_key, value) => {
    expect(value.startsWith("knowledge.generation.")).toBe(true);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeGeneratorEventType);
    expect(new Set(values).size).toBe(values.length);
  });
});
