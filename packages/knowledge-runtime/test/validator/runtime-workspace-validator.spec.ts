import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimeWorkspaceValidator } from "../../src/validator/runtime-workspace-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimeWorkspaceValidator", () => {
  it("passes when no allow-list is configured", () => {
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
    });
    expect(new RuntimeWorkspaceValidator().validate({ execution }).valid).toBe(true);
  });

  it("passes when workspaceId is unset (nothing to check)", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(
      new RuntimeWorkspaceValidator().validate({ execution, allowedWorkspaceIds: ["ws-1"] }).valid,
    ).toBe(true);
  });

  it("fails when workspaceId is not in the allow-list", () => {
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      workspaceId: "ws-2",
    });
    expect(
      new RuntimeWorkspaceValidator().validate({ execution, allowedWorkspaceIds: ["ws-1"] }).valid,
    ).toBe(false);
  });
});
