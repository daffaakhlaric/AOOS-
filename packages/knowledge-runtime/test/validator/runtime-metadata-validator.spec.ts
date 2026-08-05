import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimeMetadataValidator } from "../../src/validator/runtime-metadata-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimeMetadataValidator", () => {
  it("passes for unique labels", () => {
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      metadata: { labels: ["a", "b"] },
    });
    expect(new RuntimeMetadataValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails for duplicate labels", () => {
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      metadata: { labels: ["a", "a"] },
    });
    expect(new RuntimeMetadataValidator().validate({ execution }).valid).toBe(false);
  });
});
