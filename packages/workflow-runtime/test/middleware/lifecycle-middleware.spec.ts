import { describe, expect, it, vi } from "vitest";

import { LifecycleException } from "../../src/errors/lifecycle-exception.js";
import { InstanceState } from "../../src/instance/instance-state.js";
import { WorkflowLifecycleManager } from "../../src/lifecycle/workflow-lifecycle-manager.js";
import type { RuntimeMiddlewareContext } from "../../src/middleware/i-runtime-middleware.js";
import { LifecycleMiddleware } from "../../src/middleware/lifecycle-middleware.js";
import { WorkflowStateMachine } from "../../src/state-machine/workflow-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Runtime Middleware Test — LifecycleMiddleware (terminal stage)", () => {
  const manager = new WorkflowLifecycleManager(new WorkflowStateMachine());

  it("applies the transition matching context.operation and writes it back onto context.execution", async () => {
    const middleware = new LifecycleMiddleware(manager);
    const next = vi.fn(async () => {});
    const context: RuntimeMiddlewareContext = {
      execution: executionFixture({ status: InstanceState.CREATED }),
      operation: "initialize",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(context.execution.instance.status).toBe(InstanceState.READY);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("passes an optional reason through for pause/cancel/fail", async () => {
    const middleware = new LifecycleMiddleware(manager);
    const context: RuntimeMiddlewareContext = {
      execution: executionFixture({ status: InstanceState.RUNNING }),
      operation: "fail",
      metadata: { reason: "boom" },
    };
    await middleware.execute(context, async () => {});
    expect(context.execution.instance.status).toBe(InstanceState.FAILED);
    expect(context.execution.context.executionHistory[0]?.reason).toBe("boom");
  });

  it("throws LifecycleException for an unknown operation", async () => {
    const middleware = new LifecycleMiddleware(manager);
    const context: RuntimeMiddlewareContext = {
      execution: executionFixture({ status: InstanceState.CREATED }),
      operation: "not-a-real-operation",
      metadata: {},
    };
    await expect(middleware.execute(context, async () => {})).rejects.toThrow(LifecycleException);
  });
});
