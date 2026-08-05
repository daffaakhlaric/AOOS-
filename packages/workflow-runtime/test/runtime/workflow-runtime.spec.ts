import type { BaseEventShape, PublishInput } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { IllegalTransitionException } from "../../src/errors/illegal-transition-exception.js";
import { InstanceNotFoundException } from "../../src/errors/instance-not-found-exception.js";
import { ReplayNotSupportedException } from "../../src/errors/replay-not-supported-exception.js";
import { WorkflowNotFoundException } from "../../src/errors/workflow-not-found-exception.js";
import { WorkflowValidationException } from "../../src/errors/workflow-validation-exception.js";
import { WorkflowRuntimeEventPublisher } from "../../src/events/workflow-runtime-event-publisher.js";
import { WorkflowRuntimeEventType } from "../../src/events/workflow-runtime-event-type.js";
import { InstanceState } from "../../src/instance/instance-state.js";
import type { IRuntimeMiddleware } from "../../src/middleware/i-runtime-middleware.js";
import { WorkflowRuntime } from "../../src/runtime/workflow-runtime.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { registryFixture } from "../helpers/registry-fixture.js";

function runtimeFixture(config?: ConstructorParameters<typeof WorkflowRuntime>[0]["config"]) {
  const { publisher, publish } = fakePublisher();
  const registry = registryFixture([
    definitionFixture({ version: "1.0.0" }),
    definitionFixture({ version: "2.0.0" }),
  ]);
  const runtime = new WorkflowRuntime({
    definitionRegistry: registry,
    eventPublisher: new WorkflowRuntimeEventPublisher(publisher),
    config,
  });
  return { runtime, publish, registry };
}

describe("Runtime Architecture Test — WorkflowRuntime", () => {
  it("createInstance() loads the latest Definition, creates a CREATED Instance pointed at Start, and publishes CREATED", async () => {
    const { runtime, publish } = runtimeFixture();
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });

    expect(execution.instance.status).toBe(InstanceState.CREATED);
    expect(execution.instance.workflowVersion).toBe("2.0.0");
    expect(execution.instance.executionPointer.currentNodeId).toBe("start");
    expect(publish).toHaveBeenCalledTimes(1);
    expect((publish.mock.calls[0]![0] as PublishInput).type).toBe(WorkflowRuntimeEventType.CREATED);
  });

  it("createInstance() honors an explicit workflowVersion", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createInstance({
      workflowId: "sample-workflow",
      workflowVersion: "1.0.0",
    });
    expect(execution.instance.workflowVersion).toBe("1.0.0");
  });

  it("createInstance() throws WorkflowNotFoundException for an unregistered Workflow id", async () => {
    const { runtime } = runtimeFixture();
    await expect(runtime.createInstance({ workflowId: "ghost" })).rejects.toThrow(
      WorkflowNotFoundException,
    );
  });

  it("runs the full happy-path lifecycle: initialize -> start -> pause -> resume -> complete, publishing matching events", async () => {
    const { runtime, publish } = runtimeFixture();
    const created = await runtime.createInstance({ workflowId: "sample-workflow" });
    const token = created.instance.token;

    const ready = await runtime.initialize(token);
    expect(ready.instance.status).toBe(InstanceState.READY);

    const running = await runtime.start(token);
    expect(running.instance.status).toBe(InstanceState.RUNNING);
    expect(running.instance.startedAt).toBeTruthy();

    const paused = await runtime.pause(token, "operator");
    expect(paused.instance.status).toBe(InstanceState.PAUSED);

    const resumed = await runtime.resume(token);
    expect(resumed.instance.status).toBe(InstanceState.RUNNING);

    const completed = await runtime.complete(token);
    expect(completed.instance.status).toBe(InstanceState.COMPLETED);
    expect(completed.instance.completedAt).toBeTruthy();

    const publishedTypes = publish.mock.calls.map((call) => (call[0] as PublishInput).type);
    expect(publishedTypes).toEqual([
      WorkflowRuntimeEventType.CREATED,
      WorkflowRuntimeEventType.INITIALIZED,
      WorkflowRuntimeEventType.STATE_CHANGED,
      WorkflowRuntimeEventType.STARTED,
      WorkflowRuntimeEventType.STATE_CHANGED,
      WorkflowRuntimeEventType.PAUSED,
      WorkflowRuntimeEventType.STATE_CHANGED,
      WorkflowRuntimeEventType.RESUMED,
      WorkflowRuntimeEventType.STATE_CHANGED,
      WorkflowRuntimeEventType.COMPLETED,
      WorkflowRuntimeEventType.STATE_CHANGED,
    ]);
  });

  it("cancel() from CREATED publishes CANCELLED", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });
    const cancelled = await runtime.cancel(execution.instance.token, "user requested");
    expect(cancelled.instance.status).toBe(InstanceState.CANCELLED);
  });

  it("expire() from READY publishes EXPIRED", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });
    await runtime.initialize(execution.instance.token);
    const expired = await runtime.expire(execution.instance.token);
    expect(expired.instance.status).toBe(InstanceState.EXPIRED);
  });

  it("fail() from RUNNING records the reason and publishes FAILED", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });
    await runtime.initialize(execution.instance.token);
    await runtime.start(execution.instance.token);
    const failed = await runtime.fail(execution.instance.token, "boom");
    expect(failed.instance.status).toBe(InstanceState.FAILED);
    expect(failed.context.executionHistory.at(-1)?.reason).toBe("boom");
  });

  it("an illegal transition throws IllegalTransitionException and leaves state unchanged", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });
    await expect(runtime.complete(execution.instance.token)).rejects.toThrow(
      IllegalTransitionException,
    );
    expect(runtime.getInstance(execution.instance.token)?.instance.status).toBe(
      InstanceState.CREATED,
    );
  });

  it("operating on an unknown ExecutionToken throws InstanceNotFoundException", async () => {
    const { runtime } = runtimeFixture();
    await expect(runtime.start("wtok_ghost")).rejects.toThrow(InstanceNotFoundException);
  });

  it("getInstance()/requireInstance()/listInstances() resolve strictly by ExecutionToken", async () => {
    const { runtime } = runtimeFixture();
    const a = await runtime.createInstance({ workflowId: "sample-workflow", tenantId: "tenant-a" });
    const b = await runtime.createInstance({ workflowId: "sample-workflow", tenantId: "tenant-b" });

    expect(runtime.getInstance(a.instance.token)?.instance.id).toBe(a.instance.id);
    expect(runtime.requireInstance(b.instance.token).instance.id).toBe(b.instance.id);
    expect(() => runtime.requireInstance("wtok_ghost")).toThrow(InstanceNotFoundException);
    expect(runtime.listInstances()).toHaveLength(2);
    expect(runtime.listInstances("tenant-a")).toHaveLength(1);
  });

  it("snapshot() captures a Snapshot, updates the Instance's snapshotRef, and publishes SNAPSHOT_CREATED", async () => {
    const { runtime, publish } = runtimeFixture();
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });
    const snapshot = await runtime.snapshot(execution.instance.token);

    expect(snapshot.instanceToken).toBe(execution.instance.token);
    expect(runtime.getInstance(execution.instance.token)?.instance.snapshotRef?.snapshotId).toBe(
      snapshot.id,
    );
    expect(runtime.listSnapshots(execution.instance.token)).toHaveLength(1);

    const last = publish.mock.calls.at(-1)![0] as PublishInput;
    expect(last.type).toBe(WorkflowRuntimeEventType.SNAPSHOT_CREATED);
  });

  it("replay() throws ReplayNotSupportedException when no IWorkflowReplay is configured", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });
    expect(() => runtime.replay(execution.instance.token)).toThrow(ReplayNotSupportedException);
  });

  it("replay() delegates to a configured IWorkflowReplay", async () => {
    const fakeEvents: readonly BaseEventShape[] = [];
    const replayProvider = { replayInstance: vi.fn(async () => fakeEvents) };
    const { runtime } = runtimeFixture({ replayProvider });
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });

    const result = await runtime.replay(execution.instance.token);

    expect(replayProvider.replayInstance).toHaveBeenCalledWith(execution.instance.token);
    expect(result).toBe(fakeEvents);
  });

  it("replay() still throws InstanceNotFoundException for an unknown token even with a provider configured", async () => {
    const replayProvider = { replayInstance: vi.fn() };
    const { runtime } = runtimeFixture({ replayProvider });
    expect(() => runtime.replay("wtok_ghost")).toThrow(InstanceNotFoundException);
  });

  it("health()/metrics()/monitorSnapshot() reflect live activity", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });
    await runtime.initialize(execution.instance.token);
    await runtime.start(execution.instance.token);
    await runtime.complete(execution.instance.token);

    expect(runtime.metrics().completedWorkflows).toBe(1);
    expect(runtime.health().status).toBe("healthy");
    expect(runtime.monitorSnapshot().metrics.completedWorkflows).toBe(1);
  });

  it("use() registers a custom Middleware that runs on every subsequent operation", async () => {
    const { runtime } = runtimeFixture();
    const calls: string[] = [];
    const auditMiddleware: IRuntimeMiddleware = {
      name: "audit",
      async execute(context, next) {
        calls.push(context.operation);
        await next();
      },
    };
    runtime.use(auditMiddleware);

    const execution = await runtime.createInstance({ workflowId: "sample-workflow" });
    await runtime.initialize(execution.instance.token);
    await runtime.start(execution.instance.token);

    expect(calls).toEqual(["initialize", "start"]);
  });

  it("createInstance() enforces Tenant Isolation for a TENANT-scoped Workflow Definition", async () => {
    const { WorkflowBuilder, NodeType, TransitionKind, TenantScope } =
      await import("@aos/workflow-definition");
    const tenantDefinition = WorkflowBuilder.create("tenant-workflow", "1.0.0")
      .withTenantScope(TenantScope.TENANT, "tenant-a")
      .addNode({ id: "start", name: "Start", type: NodeType.START })
      .addNode({ id: "end", name: "End", type: NodeType.END })
      .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "end" })
      .build();
    const { publisher } = fakePublisher();
    const runtime = new WorkflowRuntime({
      definitionRegistry: registryFixture([tenantDefinition]),
      eventPublisher: new WorkflowRuntimeEventPublisher(publisher),
    });

    await expect(
      runtime.createInstance({ workflowId: "tenant-workflow", tenantId: "tenant-b" }),
    ).rejects.toThrow(WorkflowValidationException);
  });
});
