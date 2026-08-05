import { describe, expect, it } from "vitest";

import { NodeState } from "../../src/contracts/node-state.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { NodeValidationException } from "../../src/errors/node-validation-exception.js";
import { NodeLifecycleManager } from "../../src/lifecycle/node-lifecycle-manager.js";
import { NodeStateMachine } from "../../src/lifecycle/node-state-machine.js";
import { ValidationPipeline } from "../../src/validator/validation-pipeline.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Lifecycle Test — NodeLifecycleManager", () => {
  const manager = new NodeLifecycleManager(new NodeStateMachine(), new ValidationPipeline());

  it("initialize() moves CREATED -> READY", () => {
    const result = manager.initialize(executionFixture({ status: NodeState.CREATED }));
    expect(result.instance.status).toBe(NodeState.READY);
  });

  it("validate() returns the execution unchanged when valid", () => {
    const execution = executionFixture({
      type: NodeType.CAPABILITY,
      config: { capabilityId: "crm.create" },
    });
    expect(manager.validate(execution)).toBe(execution);
  });

  it("validate() throws NodeValidationException when invalid", () => {
    const execution = executionFixture({ type: NodeType.CAPABILITY, config: {} });
    expect(() => manager.validate(execution)).toThrow(NodeValidationException);
  });

  it("prepare() is a pass-through no-op", () => {
    const execution = executionFixture();
    expect(manager.prepare(execution)).toBe(execution);
  });

  it("start() moves READY -> RUNNING and stamps startedAt", () => {
    const execution = executionFixture({ status: NodeState.READY });
    expect(execution.instance.startedAt).toBeUndefined();
    const result = manager.start(execution);
    expect(result.instance.status).toBe(NodeState.RUNNING);
    expect(result.instance.startedAt).toBeTruthy();
  });

  it("start() does not overwrite an existing startedAt", () => {
    const execution = executionFixture({ status: NodeState.WAITING });
    const withStartedAt = {
      ...execution,
      instance: { ...execution.instance, startedAt: "2020-01-01T00:00:00.000Z" },
    };
    const result = manager.start(withStartedAt);
    expect(result.instance.startedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("pause()/resume() round-trip RUNNING <-> PAUSED", () => {
    const running = executionFixture({ status: NodeState.RUNNING });
    const paused = manager.pause(running, "waiting on operator");
    expect(paused.instance.status).toBe(NodeState.PAUSED);
    const resumed = manager.resume(paused);
    expect(resumed.instance.status).toBe(NodeState.RUNNING);
  });

  it("complete() stamps completedAt", () => {
    const result = manager.complete(executionFixture({ status: NodeState.RUNNING }));
    expect(result.instance.status).toBe(NodeState.COMPLETED);
    expect(result.instance.completedAt).toBeTruthy();
  });

  it("fail() stamps completedAt and records a reason", () => {
    const result = manager.fail(executionFixture({ status: NodeState.RUNNING }), "boom");
    expect(result.instance.status).toBe(NodeState.FAILED);
    expect(result.instance.completedAt).toBeTruthy();
    expect(result.history[0]?.reason).toBe("boom");
  });

  it("cancel() stamps completedAt", () => {
    const result = manager.cancel(executionFixture({ status: NodeState.READY }), "user cancelled");
    expect(result.instance.status).toBe(NodeState.CANCELLED);
    expect(result.instance.completedAt).toBeTruthy();
  });

  it("timeout() stamps completedAt", () => {
    const result = manager.timeout(executionFixture({ status: NodeState.RUNNING }));
    expect(result.instance.status).toBe(NodeState.TIMED_OUT);
    expect(result.instance.completedAt).toBeTruthy();
  });
});
