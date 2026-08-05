import { NodeType, TenantScope, TransitionKind, WorkflowBuilder } from "@aos/workflow-definition";
import { describe, expect, it } from "vitest";

import { createWorkflowContext } from "../../src/context/create-workflow-context.js";
import { WorkflowRuntimeValidator } from "../../src/validator/workflow-runtime-validator.js";
import { definitionFixture } from "../helpers/definition-fixture.js";

describe("Workflow Validator Test — WorkflowRuntimeValidator", () => {
  it("passes a structurally valid, tenant-agnostic Workflow Definition", () => {
    const validator = new WorkflowRuntimeValidator();
    const context = createWorkflowContext({ correlationId: "corr-1" });
    const result = validator.validate(definitionFixture(), context);
    expect(result.valid).toBe(true);
  });

  it("surfaces @aos/workflow-definition ValidationPipeline issues (e.g. an unresolved Transition target)", () => {
    const validator = new WorkflowRuntimeValidator();
    const badDefinition = WorkflowBuilder.create("bad-workflow", "1.0.0")
      .addNode({ id: "start", name: "Start", type: NodeType.START })
      .addNode({ id: "end", name: "End", type: NodeType.END })
      .addTransition({
        id: "t-1",
        kind: TransitionKind.NEXT,
        fromNodeId: "start",
        toNodeId: "missing",
      })
      .build();
    const context = createWorkflowContext({ correlationId: "corr-1" });
    const result = validator.validate(badDefinition, context);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("fails Tenant Isolation when Context tenantId does not match a TENANT-scoped Definition", () => {
    const validator = new WorkflowRuntimeValidator();
    const definition = WorkflowBuilder.create("tenant-workflow", "1.0.0")
      .withTenantScope(TenantScope.TENANT, "tenant-a")
      .addNode({ id: "start", name: "Start", type: NodeType.START })
      .addNode({ id: "end", name: "End", type: NodeType.END })
      .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "end" })
      .build();
    const context = createWorkflowContext({ correlationId: "corr-1", tenantId: "tenant-b" });
    const result = validator.validate(definition, context);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "tenantId")).toBe(true);
  });

  it("passes Tenant Isolation when Context tenantId matches the TENANT-scoped Definition", () => {
    const validator = new WorkflowRuntimeValidator();
    const definition = WorkflowBuilder.create("tenant-workflow", "1.0.0")
      .withTenantScope(TenantScope.TENANT, "tenant-a")
      .addNode({ id: "start", name: "Start", type: NodeType.START })
      .addNode({ id: "end", name: "End", type: NodeType.END })
      .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "end" })
      .build();
    const context = createWorkflowContext({ correlationId: "corr-1", tenantId: "tenant-a" });
    expect(validator.validate(definition, context).valid).toBe(true);
  });
});
