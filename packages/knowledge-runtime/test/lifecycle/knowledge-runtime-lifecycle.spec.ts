import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeState } from "../../src/domain/knowledge-runtime-state.js";
import { KnowledgeRuntimeLifecycle } from "../../src/lifecycle/knowledge-runtime-lifecycle.js";
import { KnowledgeRuntimeStateMachine } from "../../src/state-machine/knowledge-runtime-state-machine.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Lifecycle Test — KnowledgeRuntimeLifecycle", () => {
  it("walks the full happy path: load -> markLoaded -> validate -> markReady -> start -> complete", async () => {
    const { asset } = await engineFixture();
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    let execution = executionFixture(asset);

    execution = lifecycle.load(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.LOADING);

    execution = lifecycle.markLoaded(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.LOADED);

    execution = lifecycle.validate(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.VALIDATING);

    execution = lifecycle.markReady(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.READY);

    execution = lifecycle.start(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.RUNNING);
    expect(execution.instance.startedAt).toBeTruthy();

    execution = lifecycle.complete(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.COMPLETED);
    expect(execution.instance.completedAt).toBeTruthy();
  });

  it("suspend()/resume()/markResumed() round-trips RUNNING -> SUSPENDED -> RESUMING -> RUNNING", async () => {
    const { asset } = await engineFixture();
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    let execution = executionFixture(asset);
    execution = lifecycle.load(execution);
    execution = lifecycle.markLoaded(execution);
    execution = lifecycle.validate(execution);
    execution = lifecycle.markReady(execution);
    execution = lifecycle.start(execution);

    execution = lifecycle.suspend(execution, "maintenance");
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.SUSPENDED);
    expect(execution.history.at(-1)?.reason).toBe("maintenance");

    execution = lifecycle.resume(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.RESUMING);
    expect(execution.instance.statistics.resumeCount).toBe(1);

    execution = lifecycle.markResumed(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.RUNNING);
  });

  it("fail() stamps completedAt and moves to FAILED", async () => {
    const { asset } = await engineFixture();
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    let execution = executionFixture(asset);
    execution = lifecycle.load(execution);
    execution = lifecycle.fail(execution, "load error");
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.FAILED);
    expect(execution.instance.completedAt).toBeTruthy();
  });

  it("cancel() stamps completedAt and moves to CANCELLED", async () => {
    const { asset } = await engineFixture();
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    const execution = lifecycle.cancel(executionFixture(asset), "no longer needed");
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.CANCELLED);
    expect(execution.instance.completedAt).toBeTruthy();
  });

  it("expire() stamps completedAt and moves to EXPIRED", async () => {
    const { asset } = await engineFixture();
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    let execution = executionFixture(asset);
    execution = lifecycle.load(execution);
    execution = lifecycle.markLoaded(execution);
    execution = lifecycle.validate(execution);
    execution = lifecycle.markReady(execution);
    execution = lifecycle.expire(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.EXPIRED);
    expect(execution.instance.completedAt).toBeTruthy();
  });

  it("destroy() moves a terminal Instance to DESTROYED", async () => {
    const { asset } = await engineFixture();
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    let execution = executionFixture(asset);
    execution = lifecycle.cancel(execution);
    execution = lifecycle.destroy(execution);
    expect(execution.instance.state).toBe(KnowledgeRuntimeState.DESTROYED);
  });
});
