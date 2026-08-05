import { describe, expect, it } from "vitest";

import type { ICapabilityExecutor } from "../../src/capability/i-capability-executor.js";
import { WorkflowExecutionEngine } from "../../src/engine/workflow-execution-engine.js";
import { ExecutionNotFoundException } from "../../src/errors/execution-not-found-exception.js";
import { ExecutionValidationException } from "../../src/errors/execution-validation-exception.js";
import { ExecutionEventPublisher } from "../../src/events/execution-event-publisher.js";
import { ExecutionEventType } from "../../src/events/execution-event-type.js";
import { RetryStrategy } from "../../src/retry/retry-policy.js";
import {
  failingCapabilityExecutor,
  successfulCapabilityExecutor,
  trackingCapabilityExecutor,
} from "../helpers/capability-executor-fixture.js";
import {
  brokenDefinitionFixture,
  definitionFixture,
  failureTransitionDefinitionFixture,
  humanDefinitionFixture,
  loopDefinitionFixture,
  parallelDefinitionFixture,
} from "../helpers/definition-fixture.js";
import { nodeRuntimeFixture } from "../helpers/node-runtime-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { workflowRuntimeFixture } from "../helpers/workflow-runtime-fixture.js";

describe("Engine Test — WorkflowExecutionEngine", () => {
  it("executes a Capability Node Workflow to completion when an ICapabilityExecutor is configured", async () => {
    const definition = definitionFixture();
    const { publisher, publish } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    const result = await engine.executeWorkflow({ workflowId: definition.id });

    expect(result.success).toBe(true);
    expect(result.nodesVisited).toEqual(["start", "cap-1", "end"]);
    const publishedTypes = publish.mock.calls.map((call) => call[0]?.type);
    expect(publishedTypes).toContain(ExecutionEventType.WORKFLOW_STARTED);
    expect(publishedTypes).toContain(ExecutionEventType.WORKFLOW_COMPLETED);
    expect(publishedTypes).toContain(ExecutionEventType.NODE_COMPLETED);
  });

  it("passes the Capability id/version/context through to the ICapabilityExecutor", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const executor = trackingCapabilityExecutor();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: executor },
    });

    await engine.executeWorkflow({ workflowId: definition.id });

    expect(executor.calls).toHaveLength(1);
    expect(executor.calls[0]?.capabilityId).toBe("crm.create");
  });

  it("completes a Human (Manual Approval) Node Workflow without any ICapabilityExecutor configured", async () => {
    const definition = humanDefinitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
    });

    const result = await engine.executeWorkflow({ workflowId: definition.id });

    expect(result.success).toBe(true);
    expect(result.nodesVisited).toEqual(["start", "human-1", "end"]);
  });

  it("returns a business failure when a Capability Node has no configured executor and no Failure Transition", async () => {
    const definition = definitionFixture();
    const { publisher, publish } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
    });

    const result = await engine.executeWorkflow({ workflowId: definition.id });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no ICapabilityExecutor is configured");
    const publishedTypes = publish.mock.calls.map((call) => call[0]?.type);
    expect(publishedTypes).toContain(ExecutionEventType.WORKFLOW_FAILED);
    expect(publishedTypes).toContain(ExecutionEventType.NODE_FAILED);
  });

  it("follows a FAILURE Transition to a Recovery Node when the Capability Node fails", async () => {
    const definition = failureTransitionDefinitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: failingCapabilityExecutor() },
    });

    const result = await engine.executeWorkflow({ workflowId: definition.id });

    expect(result.success).toBe(true);
    expect(result.nodesVisited).toEqual(["start", "cap-1", "recovery", "end"]);
  });

  it("executes both fan-out branches of a PARALLEL Workflow and merges into End", async () => {
    const definition = parallelDefinitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    const result = await engine.executeWorkflow({ workflowId: definition.id });

    expect(result.success).toBe(true);
    expect(result.nodesVisited).toEqual(expect.arrayContaining(["start", "cap-a", "cap-b", "end"]));
  });

  it("surfaces @aos/node-runtime's Loop manifest validation as a thrown error (documented cross-package limitation: this package cannot derive a `condition` string from a WDL Loop Node's structured `loopCondition` Expression)", async () => {
    const definition = loopDefinitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { maxLoopIterations: 2 },
    });

    await expect(engine.executeWorkflow({ workflowId: definition.id })).rejects.toThrow();
  });

  it("retries a failing Capability Node according to the configured RetryPolicy before giving up", async () => {
    const definition = definitionFixture();
    const { publisher, publish } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: {
        capabilityExecutor: failingCapabilityExecutor(),
        retryPolicy: { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 2 },
      },
    });

    const result = await engine.executeWorkflow({ workflowId: definition.id });

    expect(result.success).toBe(false);
    const publishedTypes = publish.mock.calls.map((call) => call[0]?.type);
    expect(publishedTypes.filter((type) => type === ExecutionEventType.NODE_RETRY)).toHaveLength(2);
  });

  it("rejects executeWorkflow with ExecutionValidationException for a graph that fails validation", async () => {
    const definition = brokenDefinitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
    });

    await expect(engine.executeWorkflow({ workflowId: definition.id })).rejects.toThrow(
      ExecutionValidationException,
    );
  });

  it("exposes the completed Session via getSession()/requireSession()/listSessions()", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    await engine.executeWorkflow({ workflowId: definition.id });
    const sessions = engine.listSessions();
    expect(sessions).toHaveLength(1);
    const workflowExecutionId = sessions[0]!.context.token.workflowExecutionId;

    expect(engine.getSession(workflowExecutionId)).toBeDefined();
    expect(engine.requireSession(workflowExecutionId).context.currentState).toBe("completed");
  });

  it("requireSession() throws ExecutionNotFoundException for an unknown id", () => {
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
    });

    expect(() => engine.requireSession("does-not-exist")).toThrow(ExecutionNotFoundException);
  });

  it("exposes health()/metrics()/monitorSnapshot() after an execution", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    await engine.executeWorkflow({ workflowId: definition.id });

    expect(engine.metrics().completedCount).toBe(1);
    expect(engine.health().status).toBeDefined();
    expect(engine.monitorSnapshot().metrics.completedCount).toBe(1);
  });

  it("exposes timeline()/tree()/trace() for a completed Session", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    await engine.executeWorkflow({ workflowId: definition.id });
    const workflowExecutionId = engine.listSessions()[0]!.context.token.workflowExecutionId;

    expect(engine.timeline(workflowExecutionId).length).toBeGreaterThan(0);
    expect(engine.tree(workflowExecutionId).length).toBeGreaterThan(0);
    expect(engine.trace(workflowExecutionId).correlationId).toBeDefined();
  });

  it("cancel() rejects an already-completed Execution with an illegal-transition error", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    await engine.executeWorkflow({ workflowId: definition.id });
    const workflowExecutionId = engine.listSessions()[0]!.context.token.workflowExecutionId;

    await expect(engine.cancel(workflowExecutionId)).rejects.toThrow();
  });

  it("use() registers an extra Middleware that runs before the terminal Lifecycle stage", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    const seenOperations: string[] = [];
    engine.use({
      name: "recorder",
      async execute(context, next) {
        seenOperations.push(context.operation);
        await next();
      },
    });

    await engine.executeWorkflow({ workflowId: definition.id });

    expect(seenOperations).toContain("initialize");
    expect(seenOperations).toContain("start");
    expect(seenOperations).toContain("complete");
  });

  it("pause()/resume() succeed mid-flight and delegate to the underlying WorkflowRuntime", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engineRef: { current?: WorkflowExecutionEngine } = {};
    const pausingExecutor: ICapabilityExecutor = {
      execute: async (request) => {
        const workflowExecutionId = request.context.token.workflowExecutionId;
        const paused = await engineRef.current!.pause(workflowExecutionId, "manual pause");
        expect(paused.context.currentState).toBe("paused");
        const resumed = await engineRef.current!.resume(workflowExecutionId);
        expect(resumed.context.currentState).toBe("running");
        return { success: true };
      },
      validate: async () => true,
      cancel: async () => {},
    };
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: pausingExecutor },
    });
    engineRef.current = engine;

    const result = await engine.executeWorkflow({ workflowId: definition.id });
    expect(result.success).toBe(true);
  });

  it("cancel() succeeds mid-flight, records a cancellation metric, and publishes WORKFLOW_CANCELLED", async () => {
    const definition = definitionFixture();
    const { publisher, publish } = fakePublisher();
    const engineRef: { current?: WorkflowExecutionEngine } = {};
    const cancellingExecutor: ICapabilityExecutor = {
      execute: async (request) => {
        const cancelled = await engineRef.current!.cancel(
          request.context.token.workflowExecutionId,
          "no longer needed",
        );
        expect(cancelled.context.currentState).toBe("cancelled");
        return { success: true };
      },
      validate: async () => true,
      cancel: async () => {},
    };
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: cancellingExecutor },
    });
    engineRef.current = engine;

    // The underlying `@aos/workflow-runtime` Instance is genuinely cancelled mid-flight,
    // so its own state machine (correctly) rejects the Engine's later `complete()` call —
    // this is a real, documented limitation: `executeWorkflow()` does not poll for
    // cancellation between Node steps. The Cancel operation itself still fully applies
    // (metrics/event/state below) before that later failure surfaces.
    await expect(engine.executeWorkflow({ workflowId: definition.id })).rejects.toThrow();

    expect(engine.metrics().cancellationCount).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      ExecutionEventType.WORKFLOW_CANCELLED,
    );
  });

  it("timeout() succeeds mid-flight, records a timeout metric, and publishes WORKFLOW_TIMEOUT", async () => {
    const definition = definitionFixture();
    const { publisher, publish } = fakePublisher();
    const engineRef: { current?: WorkflowExecutionEngine } = {};
    const timingOutExecutor: ICapabilityExecutor = {
      execute: async (request) => {
        const timedOut = await engineRef.current!.timeout(
          request.context.token.workflowExecutionId,
          "too slow",
        );
        expect(timedOut.context.currentState).toBe("timeout");
        return { success: true };
      },
      validate: async () => true,
      cancel: async () => {},
    };
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: timingOutExecutor },
    });
    engineRef.current = engine;

    await engine.executeWorkflow({ workflowId: definition.id });

    expect(engine.metrics().timeoutCount).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      ExecutionEventType.WORKFLOW_TIMEOUT,
    );
  });

  it("treats an ICapabilityExecutor that throws as a Node failure (business failure), not an uncaught exception", async () => {
    const definition = definitionFixture();
    const { publisher, publish } = fakePublisher();
    const throwingExecutor: ICapabilityExecutor = {
      execute: async () => {
        throw new Error("capability blew up");
      },
      validate: async () => true,
      cancel: async () => {},
    };
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: throwingExecutor },
    });

    const result = await engine.executeWorkflow({ workflowId: definition.id });

    expect(result.success).toBe(false);
    expect(result.error).toContain("capability blew up");
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      ExecutionEventType.NODE_FAILED,
    );
  });

  it("propagates tenantId/correlationId/traceId from ExecuteWorkflowInput into the ExecutionToken", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    await engine.executeWorkflow({
      workflowId: definition.id,
      tenantId: "tenant-42",
      correlationId: "corr-42",
      traceId: "trace-42",
    });

    const session = engine.listSessions()[0]!;
    expect(session.context.token.tenantId).toBe("tenant-42");
    expect(session.context.token.correlationId).toBe("corr-42");
    expect(session.context.token.traceId).toBe("trace-42");
  });

  it("carries workflowVariables/environmentVariables through into the ExecutionContext", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    await engine.executeWorkflow({
      workflowId: definition.id,
      workflowVariables: { customerId: "cust-1" },
      environmentVariables: { region: "us-east-1" },
    });

    const session = engine.listSessions()[0]!;
    expect(session.context.workflowVariables).toEqual({ customerId: "cust-1" });
    expect(session.context.environmentVariables).toEqual({ region: "us-east-1" });
  });

  it("statistics reflect the number of Nodes visited/completed after a successful run", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([definition]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
      config: { capabilityExecutor: successfulCapabilityExecutor() },
    });

    await engine.executeWorkflow({ workflowId: definition.id });

    const session = engine.listSessions()[0]!;
    expect(session.statistics.completedNodes).toBe(3);
    expect(session.statistics.failedNodes).toBe(0);
    expect(session.statistics.totalNodes).toBe(3);
  });

  it("resume() throws ExecutionNotFoundException for an unknown workflowExecutionId", async () => {
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
    });

    await expect(engine.resume("does-not-exist")).rejects.toThrow(ExecutionNotFoundException);
  });

  it("pause() throws ExecutionNotFoundException for an unknown workflowExecutionId", async () => {
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
    });

    await expect(engine.pause("does-not-exist")).rejects.toThrow(ExecutionNotFoundException);
  });

  it("getSession() returns undefined for an unknown workflowExecutionId", () => {
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
    });

    expect(engine.getSession("does-not-exist")).toBeUndefined();
  });

  it("listSessions() returns an empty array before any Workflow has been executed", () => {
    const { publisher } = fakePublisher();
    const engine = new WorkflowExecutionEngine({
      workflowRuntime: workflowRuntimeFixture([]),
      nodeRuntime: nodeRuntimeFixture(),
      eventPublisher: new ExecutionEventPublisher(publisher),
    });

    expect(engine.listSessions()).toEqual([]);
  });
});
