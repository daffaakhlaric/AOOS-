import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimeNamespaceValidator } from "../../src/validator/runtime-namespace-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimeNamespaceValidator", () => {
  it("passes when assetNamespace is unset", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new RuntimeNamespaceValidator().validate({ execution }).valid).toBe(true);
  });

  it("passes for a valid knowledge:// namespace", () => {
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      assetNamespace: "knowledge://tenant-1/ws-1/lib-1/doc-1",
    });
    expect(new RuntimeNamespaceValidator().validate({ execution }).valid).toBe(true);
  });

  it("fails for a malformed namespace", () => {
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      assetNamespace: "not-a-namespace",
    });
    expect(new RuntimeNamespaceValidator().validate({ execution }).valid).toBe(false);
  });
});
