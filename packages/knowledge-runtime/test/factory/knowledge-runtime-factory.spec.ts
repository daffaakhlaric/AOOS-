import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeState } from "../../src/domain/knowledge-runtime-state.js";
import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";

describe("Factory Test — KnowledgeRuntimeFactory", () => {
  it("createExecution() builds a fresh Execution in the CREATED state", () => {
    const factory = new KnowledgeRuntimeFactory();
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.CREATED);
    expect(execution.instance.knowledgeId).toBe("k-1");
    expect(execution.instance.token).toBe(execution.context.token);
    expect(execution.history).toEqual([]);
  });

  it("createExecution() honors optional overrides", () => {
    const factory = new KnowledgeRuntimeFactory();
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
      assetNamespace: "knowledge://tenant-1/ws-1/lib-1/doc-1",
      metadata: { createdBy: "user-1", labels: ["a", "b"] },
    });
    expect(execution.instance.workspaceId).toBe("ws-1");
    expect(execution.instance.assetNamespace).toBe("knowledge://tenant-1/ws-1/lib-1/doc-1");
    expect(execution.instance.metadata.createdBy).toBe("user-1");
    expect(execution.instance.metadata.labels).toEqual(["a", "b"]);
  });

  it("exposes context/session/snapshot/metadata/token sub-factories", () => {
    const factory = new KnowledgeRuntimeFactory();
    expect(factory.context).toBeDefined();
    expect(factory.session).toBeDefined();
    expect(factory.snapshot).toBeDefined();
    expect(factory.metadata).toBeDefined();
    expect(factory.token).toBeDefined();
  });
});
