import { describe, expect, it } from "vitest";

import { InstanceState } from "../../src/instance/instance-state.js";
import { WorkflowLifecycleManager } from "../../src/lifecycle/workflow-lifecycle-manager.js";
import { WorkflowStateMachine } from "../../src/state-machine/workflow-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Lifecycle Test — WorkflowLifecycleManager", () => {
  const manager = new WorkflowLifecycleManager(new WorkflowStateMachine());

  it("initialize() moves CREATED -> READY", () => {
    const result = manager.initialize(executionFixture({ status: InstanceState.CREATED }));
    expect(result.instance.status).toBe(InstanceState.READY);
  });

  it("start() moves READY -> RUNNING and stamps startedAt", () => {
    const execution = executionFixture({ status: InstanceState.READY });
    expect(execution.instance.startedAt).toBeUndefined();
    const result = manager.start(execution);
    expect(result.instance.status).toBe(InstanceState.RUNNING);
    expect(result.instance.startedAt).toBeTruthy();
  });

  it("start() does not overwrite an existing startedAt", () => {
    const execution = executionFixture({ status: InstanceState.WAITING });
    const withStartedAt = {
      ...execution,
      instance: { ...execution.instance, startedAt: "2020-01-01T00:00:00.000Z" },
    };
    const result = manager.start(withStartedAt);
    expect(result.instance.startedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("pause()/resume() round-trip RUNNING <-> PAUSED", () => {
    const running = executionFixture({ status: InstanceState.RUNNING });
    const paused = manager.pause(running, "operator request");
    expect(paused.instance.status).toBe(InstanceState.PAUSED);
    const resumed = manager.resume(paused);
    expect(resumed.instance.status).toBe(InstanceState.RUNNING);
  });

  it("cancel() stamps completedAt", () => {
    const result = manager.cancel(
      executionFixture({ status: InstanceState.READY }),
      "user cancelled",
    );
    expect(result.instance.status).toBe(InstanceState.CANCELLED);
    expect(result.instance.completedAt).toBeTruthy();
  });

  it("expire() stamps completedAt", () => {
    const result = manager.expire(executionFixture({ status: InstanceState.WAITING }));
    expect(result.instance.status).toBe(InstanceState.EXPIRED);
    expect(result.instance.completedAt).toBeTruthy();
  });

  it("complete() stamps completedAt", () => {
    const result = manager.complete(executionFixture({ status: InstanceState.RUNNING }));
    expect(result.instance.status).toBe(InstanceState.COMPLETED);
    expect(result.instance.completedAt).toBeTruthy();
  });

  it("fail() stamps completedAt and records a reason", () => {
    const result = manager.fail(executionFixture({ status: InstanceState.RUNNING }), "boom");
    expect(result.instance.status).toBe(InstanceState.FAILED);
    expect(result.instance.completedAt).toBeTruthy();
    expect(result.context.executionHistory[0]?.reason).toBe("boom");
  });
});
