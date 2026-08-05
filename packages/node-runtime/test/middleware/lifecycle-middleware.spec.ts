import { describe, expect, it, vi } from "vitest";

import { NodeState } from "../../src/contracts/node-state.js";
import { NodeLifecycleException } from "../../src/errors/node-lifecycle-exception.js";
import { NodeLifecycleManager } from "../../src/lifecycle/node-lifecycle-manager.js";
import { NodeStateMachine } from "../../src/lifecycle/node-state-machine.js";
import type { NodeMiddlewareContext } from "../../src/middleware/i-node-middleware.js";
import { LifecycleMiddleware } from "../../src/middleware/lifecycle-middleware.js";
import { ValidationPipeline } from "../../src/validator/validation-pipeline.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Middleware Test — LifecycleMiddleware (terminal stage)", () => {
  const manager = new NodeLifecycleManager(new NodeStateMachine(), new ValidationPipeline());

  it("applies the operation matching context.operation and writes it back onto context.execution", async () => {
    const middleware = new LifecycleMiddleware(manager);
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture({ status: NodeState.CREATED }),
      operation: "initialize",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(context.execution.instance.status).toBe(NodeState.READY);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("passes an optional reason through for pause/cancel/fail", async () => {
    const middleware = new LifecycleMiddleware(manager);
    const context: NodeMiddlewareContext = {
      execution: executionFixture({ status: NodeState.RUNNING }),
      operation: "fail",
      metadata: { reason: "boom" },
    };
    await middleware.execute(context, async () => {});
    expect(context.execution.instance.status).toBe(NodeState.FAILED);
    expect(context.execution.history[0]?.reason).toBe("boom");
  });

  it("dispatches validate/prepare without a state transition", async () => {
    const middleware = new LifecycleMiddleware(manager);
    const execution = executionFixture({ status: NodeState.CREATED });
    const context: NodeMiddlewareContext = { execution, operation: "prepare", metadata: {} };
    await middleware.execute(context, async () => {});
    expect(context.execution.instance.status).toBe(NodeState.CREATED);
  });

  it("throws NodeLifecycleException for an unknown operation", async () => {
    const middleware = new LifecycleMiddleware(manager);
    const context: NodeMiddlewareContext = {
      execution: executionFixture({ status: NodeState.CREATED }),
      operation: "not-a-real-operation",
      metadata: {},
    };
    await expect(middleware.execute(context, async () => {})).rejects.toThrow(
      NodeLifecycleException,
    );
  });
});
