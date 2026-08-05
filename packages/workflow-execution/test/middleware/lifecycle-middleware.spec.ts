import { describe, expect, it, vi } from "vitest";

import { WorkflowExecutionException } from "../../src/errors/workflow-execution-exception.js";
import { LifecycleMiddleware } from "../../src/middleware/lifecycle-middleware.js";
import { ExecutionStateMachine } from "../../src/state-machine/execution-state-machine.js";
import { ExecutionState } from "../../src/state-machine/execution-state.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Middleware Test — LifecycleMiddleware", () => {
  it("transitions the session to the target state for a known operation", async () => {
    const middleware = new LifecycleMiddleware(new ExecutionStateMachine());
    const { session } = sessionFixture({ currentState: ExecutionState.CREATED });
    const context = { session, operation: "initialize", metadata: {} };
    const next = vi.fn(async () => {});

    await middleware.execute(context, next);

    expect(context.session.context.currentState).toBe(ExecutionState.READY);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("passes reason/nodeId metadata through to the history entry", async () => {
    const middleware = new LifecycleMiddleware(new ExecutionStateMachine());
    const { session } = sessionFixture({ currentState: ExecutionState.CREATED });
    const context = {
      session,
      operation: "initialize",
      metadata: { reason: "manual start", nodeId: "start" },
    };

    await middleware.execute(context, async () => {});

    expect(context.session.history[0]).toMatchObject({ reason: "manual start", nodeId: "start" });
  });

  it("throws WorkflowExecutionException for an unknown operation", async () => {
    const middleware = new LifecycleMiddleware(new ExecutionStateMachine());
    const { session } = sessionFixture();
    const context = { session, operation: "not-a-real-op", metadata: {} };

    await expect(middleware.execute(context, async () => {})).rejects.toThrow(
      WorkflowExecutionException,
    );
  });

  it("propagates an illegal-transition error from the underlying state machine", async () => {
    const middleware = new LifecycleMiddleware(new ExecutionStateMachine());
    const { session } = sessionFixture({ currentState: ExecutionState.CREATED });
    const context = { session, operation: "complete", metadata: {} };

    await expect(middleware.execute(context, async () => {})).rejects.toThrow();
  });
});
