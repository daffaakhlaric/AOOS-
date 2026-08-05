import type { PublishInput } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { NodeState } from "../../src/contracts/node-state.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { IllegalNodeTransitionException } from "../../src/errors/illegal-node-transition-exception.js";
import { NodeFactoryException } from "../../src/errors/node-factory-exception.js";
import { NodeInstanceNotFoundException } from "../../src/errors/node-instance-not-found-exception.js";
import { NodeValidationException } from "../../src/errors/node-validation-exception.js";
import { NodeRuntimeEventPublisher } from "../../src/events/node-runtime-event-publisher.js";
import { NodeRuntimeEventType } from "../../src/events/node-runtime-event-type.js";
import type { INodeMiddleware } from "../../src/middleware/i-node-middleware.js";
import { NodeRuntime } from "../../src/runtime/node-runtime.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function runtimeFixture(config?: ConstructorParameters<typeof NodeRuntime>[0]["config"]) {
  const { publisher, publish } = fakePublisher();
  const runtime = new NodeRuntime({
    eventPublisher: new NodeRuntimeEventPublisher(publisher),
    config,
  });
  return { runtime, publish };
}

describe("Runtime Architecture Test — NodeRuntime (public API)", () => {
  it("createFromDefinition() maps the Node Type and publishes CREATED", async () => {
    const { runtime, publish } = runtimeFixture();
    const definition = definitionFixture();
    const execution = await runtime.createFromDefinition({
      workflowInstanceId: "wf-inst-1",
      definition,
      nodeId: "cap-1",
    });

    expect(execution.instance.status).toBe(NodeState.CREATED);
    expect(execution.instance.type).toBe(NodeType.CAPABILITY);
    expect(publish).toHaveBeenCalledTimes(1);
    expect((publish.mock.calls[0]![0] as PublishInput).type).toBe(NodeRuntimeEventType.CREATED);
  });

  it("createFromDefinition() throws NodeFactoryException when the mapped Node Type is not registered", async () => {
    const { runtime } = runtimeFixture({ manifests: [] });
    const definition = definitionFixture();
    await expect(
      runtime.createFromDefinition({
        workflowInstanceId: "wf-inst-1",
        definition,
        nodeId: "cap-1",
      }),
    ).rejects.toThrow(NodeFactoryException);
  });

  it("createFromRegistry() throws NodeValidationException when config fails the Manifest's configSchema", async () => {
    const { runtime } = runtimeFixture();
    await expect(
      runtime.createFromRegistry({
        workflowInstanceId: "wf-inst-1",
        nodeId: "n-1",
        type: NodeType.CAPABILITY,
        config: {},
      }),
    ).rejects.toThrow(NodeValidationException);
  });

  it("createFromRegistry() succeeds with valid config and carries Context options through", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createFromRegistry(
      {
        workflowInstanceId: "wf-inst-1",
        nodeId: "n-1",
        type: NodeType.CAPABILITY,
        config: { capabilityId: "crm.create" },
      },
      { tenantId: "tenant-a", variables: { x: 1 } },
    );
    expect(execution.context.tenantId).toBe("tenant-a");
    expect(execution.context.variables).toEqual({ x: 1 });
  });

  it("createFromBlueprint() builds and registers a Node Instance", async () => {
    const { runtime } = runtimeFixture();
    const execution = await runtime.createFromBlueprint({
      workflowInstanceId: "wf-inst-1",
      blueprint: { nodeId: "n-1", type: NodeType.CUSTOM },
    });
    expect(execution.instance.type).toBe(NodeType.CUSTOM);
    expect(runtime.getInstance(execution.instance.id)).toBeDefined();
  });

  it("runs the full happy-path lifecycle: initialize -> start -> pause -> resume -> complete, publishing matching events", async () => {
    const { runtime, publish } = runtimeFixture();
    const created = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CAPABILITY,
      config: { capabilityId: "crm.create" },
    });
    const id = created.instance.id;

    const ready = await runtime.initialize(id);
    expect(ready.instance.status).toBe(NodeState.READY);

    const running = await runtime.start(id);
    expect(running.instance.status).toBe(NodeState.RUNNING);
    expect(running.instance.startedAt).toBeTruthy();

    const paused = await runtime.pause(id, "operator");
    expect(paused.instance.status).toBe(NodeState.PAUSED);

    const resumed = await runtime.resume(id);
    expect(resumed.instance.status).toBe(NodeState.RUNNING);

    const completed = await runtime.complete(id);
    expect(completed.instance.status).toBe(NodeState.COMPLETED);
    expect(completed.instance.completedAt).toBeTruthy();

    const publishedTypes = publish.mock.calls.map((call) => (call[0] as PublishInput).type);
    expect(publishedTypes).toEqual([
      NodeRuntimeEventType.CREATED,
      NodeRuntimeEventType.INITIALIZED,
      NodeRuntimeEventType.STATE_CHANGED,
      NodeRuntimeEventType.STARTED,
      NodeRuntimeEventType.STATE_CHANGED,
      NodeRuntimeEventType.STATE_CHANGED, // pause
      NodeRuntimeEventType.STATE_CHANGED, // resume
      NodeRuntimeEventType.COMPLETED,
      NodeRuntimeEventType.STATE_CHANGED,
    ]);
  });

  it("validate()/prepare() publish no events (no state change, no dedicated event type)", async () => {
    const { runtime, publish } = runtimeFixture();
    const created = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CAPABILITY,
      config: { capabilityId: "crm.create" },
    });
    publish.mockClear();

    await runtime.validate(created.instance.id);
    await runtime.prepare(created.instance.id);

    expect(publish).not.toHaveBeenCalled();
  });

  it("cancel()/fail()/timeout() publish their dedicated event plus STATE_CHANGED", async () => {
    const { runtime, publish } = runtimeFixture();
    const created = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });

    await runtime.cancel(created.instance.id, "user requested");
    const publishedTypes = publish.mock.calls.map((call) => (call[0] as PublishInput).type);
    expect(publishedTypes).toEqual([
      NodeRuntimeEventType.CREATED,
      NodeRuntimeEventType.CANCELLED,
      NodeRuntimeEventType.STATE_CHANGED,
    ]);
  });

  it("fail() records a NodeFailure metric; timeout() transitions to TIMED_OUT", async () => {
    const { runtime } = runtimeFixture();
    const created = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    await runtime.initialize(created.instance.id);
    await runtime.start(created.instance.id);
    const failed = await runtime.fail(created.instance.id, "boom");
    expect(failed.instance.status).toBe(NodeState.FAILED);
    expect(runtime.metrics().nodeFailureCount).toBe(1);

    const other = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-2",
      type: NodeType.CUSTOM,
    });
    await runtime.initialize(other.instance.id);
    const timedOut = await runtime.timeout(other.instance.id);
    expect(timedOut.instance.status).toBe(NodeState.TIMED_OUT);
  });

  it("getInstance() returns undefined for an unknown id", () => {
    const { runtime } = runtimeFixture();
    expect(runtime.getInstance("ghost-id")).toBeUndefined();
  });

  it("an illegal transition throws IllegalNodeTransitionException and leaves state unchanged", async () => {
    const { runtime } = runtimeFixture();
    const created = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    await expect(runtime.complete(created.instance.id)).rejects.toThrow(
      IllegalNodeTransitionException,
    );
    expect(runtime.getInstance(created.instance.id)?.instance.status).toBe(NodeState.CREATED);
  });

  it("operating on an unknown id throws NodeInstanceNotFoundException", async () => {
    const { runtime } = runtimeFixture();
    await expect(runtime.start("ghost-id")).rejects.toThrow(NodeInstanceNotFoundException);
  });

  it("getInstance()/requireInstance()/listInstances() resolve by id and workflowInstanceId", async () => {
    const { runtime } = runtimeFixture();
    const a = await runtime.createFromRegistry({
      workflowInstanceId: "wf-a",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    const b = await runtime.createFromRegistry({
      workflowInstanceId: "wf-b",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });

    expect(runtime.getInstance(a.instance.id)?.instance.id).toBe(a.instance.id);
    expect(runtime.requireInstance(b.instance.id).instance.id).toBe(b.instance.id);
    expect(() => runtime.requireInstance("ghost-id")).toThrow(NodeInstanceNotFoundException);
    expect(runtime.listInstances()).toHaveLength(2);
    expect(runtime.listInstances("wf-a")).toHaveLength(1);
  });

  it("snapshot() captures the current Node Execution", async () => {
    const { runtime } = runtimeFixture();
    const created = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    const snapshot = runtime.snapshot(created.instance.id);
    expect(snapshot.nodeInstanceId).toBe(created.instance.id);
  });

  it("health()/metrics()/monitorSnapshot() reflect live activity", async () => {
    const { runtime } = runtimeFixture();
    const created = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    await runtime.initialize(created.instance.id);
    await runtime.start(created.instance.id);
    await runtime.complete(created.instance.id);

    expect(runtime.metrics().nodeSuccessCount).toBe(1);
    expect(runtime.health().status).toBe("healthy");
    expect(runtime.monitorSnapshot().metrics.nodeSuccessCount).toBe(1);
  });

  it("use() registers a custom Middleware that runs on every subsequent operation", async () => {
    const { runtime } = runtimeFixture();
    const calls: string[] = [];
    const auditMiddleware: INodeMiddleware = {
      name: "audit",
      async execute(context, next) {
        calls.push(context.operation);
        await next();
      },
    };
    runtime.use(auditMiddleware);

    const created = await runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    await runtime.initialize(created.instance.id);
    await runtime.start(created.instance.id);

    expect(calls).toEqual(["initialize", "start"]);
  });
});
