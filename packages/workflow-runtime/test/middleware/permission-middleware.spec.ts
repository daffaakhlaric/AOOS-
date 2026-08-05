import { NodeType, TenantScope, TransitionKind, WorkflowBuilder } from "@aos/workflow-definition";
import { describe, expect, it, vi } from "vitest";

import { createWorkflowContext } from "../../src/context/create-workflow-context.js";
import { PermissionException } from "../../src/errors/permission-exception.js";
import { createWorkflowInstance } from "../../src/instance/create-workflow-instance.js";
import type { WorkflowExecution } from "../../src/instance/workflow-execution.js";
import type { RuntimeMiddlewareContext } from "../../src/middleware/i-runtime-middleware.js";
import { PermissionMiddleware } from "../../src/middleware/permission-middleware.js";
import { definitionFixture } from "../helpers/definition-fixture.js";

function tenantScopedExecution(
  definitionTenantId: string,
  contextTenantId: string | undefined,
): WorkflowExecution {
  const definition = WorkflowBuilder.create("tenant-workflow", "1.0.0")
    .withTenantScope(TenantScope.TENANT, definitionTenantId)
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "end" })
    .build();
  const instance = createWorkflowInstance({
    workflowId: definition.id,
    workflowVersion: definition.version,
    tenantId: contextTenantId,
  });
  const context = createWorkflowContext({ correlationId: instance.id, tenantId: contextTenantId });
  return { definition, instance, context };
}

describe("Runtime Middleware Test — PermissionMiddleware", () => {
  it("calls next() for a Tenant-agnostic Definition with no checker configured", async () => {
    const middleware = new PermissionMiddleware();
    const next = vi.fn(async () => {});
    const context: RuntimeMiddlewareContext = {
      execution: {
        definition: definitionFixture(),
        instance: createWorkflowInstance({ workflowId: "wf", workflowVersion: "1.0.0" }),
        context: createWorkflowContext({ correlationId: "c-1" }),
      },
      operation: "start",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws PermissionException on a Tenant Isolation violation", async () => {
    const middleware = new PermissionMiddleware();
    const next = vi.fn(async () => {});
    const context: RuntimeMiddlewareContext = {
      execution: tenantScopedExecution("tenant-a", "tenant-b"),
      operation: "start",
      metadata: {},
    };
    await expect(middleware.execute(context, next)).rejects.toThrow(PermissionException);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when Context tenantId matches the Definition's Tenant scope", async () => {
    const middleware = new PermissionMiddleware();
    const next = vi.fn(async () => {});
    const context: RuntimeMiddlewareContext = {
      execution: tenantScopedExecution("tenant-a", "tenant-a"),
      operation: "start",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("defers to a supplied IPermissionChecker and throws when it denies", async () => {
    const middleware = new PermissionMiddleware({ check: vi.fn(async () => false) });
    const next = vi.fn(async () => {});
    const context: RuntimeMiddlewareContext = {
      execution: {
        definition: definitionFixture(),
        instance: createWorkflowInstance({ workflowId: "wf", workflowVersion: "1.0.0" }),
        context: createWorkflowContext({ correlationId: "c-1" }),
      },
      operation: "start",
      metadata: {},
    };
    await expect(middleware.execute(context, next)).rejects.toThrow(PermissionException);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when a supplied IPermissionChecker allows", async () => {
    const middleware = new PermissionMiddleware({ check: vi.fn(async () => true) });
    const next = vi.fn(async () => {});
    const context: RuntimeMiddlewareContext = {
      execution: {
        definition: definitionFixture(),
        instance: createWorkflowInstance({ workflowId: "wf", workflowVersion: "1.0.0" }),
        context: createWorkflowContext({ correlationId: "c-1" }),
      },
      operation: "start",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
