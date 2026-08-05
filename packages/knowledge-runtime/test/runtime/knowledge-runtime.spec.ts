import { describe, expect, it, vi } from "vitest";

import { KnowledgeRuntimeState } from "../../src/domain/knowledge-runtime-state.js";
import { ReplayNotSupportedException } from "../../src/errors/replay-not-supported-exception.js";
import { RuntimeValidationException } from "../../src/errors/runtime-validation-exception.js";
import { KnowledgeRuntimeEventType } from "../../src/events/knowledge-runtime-event-type.js";
import { runtimeFixture } from "../helpers/runtime-fixture.js";

async function createReadyInstance(
  runtime: Awaited<ReturnType<typeof runtimeFixture>>["runtime"],
  knowledgeId: string,
) {
  const execution = await runtime.createInstance({
    knowledgeId,
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
  });
  const token = execution.instance.token;
  await runtime.load(token);
  await runtime.validate(token);
  return token;
}

describe("Runtime Test — KnowledgeRuntime", () => {
  it("createInstance() registers the Instance and publishes CREATED", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    expect(runtime.getInstance(execution.instance.token)).toBe(execution);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.CREATED,
    );
  });

  it("load() reads the Asset via the Loader, records loadTime, and moves to LOADED", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    const loaded = await runtime.load(execution.instance.token);
    expect(loaded.instance.state).toBe(KnowledgeRuntimeState.LOADED);
    expect(runtime.metrics().averageLoadTimeMs).toBeGreaterThanOrEqual(0);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.LOADED,
    );
  });

  it("validate() moves LOADED -> READY and publishes READY", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    await runtime.load(execution.instance.token);
    const ready = await runtime.validate(execution.instance.token);
    expect(ready.instance.state).toBe(KnowledgeRuntimeState.READY);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.READY,
    );
  });

  it("start() moves READY -> RUNNING and publishes STARTED", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const token = await createReadyInstance(runtime, asset.id);
    const running = await runtime.start(token);
    expect(running.instance.state).toBe(KnowledgeRuntimeState.RUNNING);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.STARTED,
    );
  });

  it("suspend()/resume() round-trip and record suspendedRuntimeCount", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const token = await createReadyInstance(runtime, asset.id);
    await runtime.start(token);
    const suspended = await runtime.suspend(token, "maintenance");
    expect(suspended.instance.state).toBe(KnowledgeRuntimeState.SUSPENDED);
    expect(runtime.metrics().suspendedRuntimeCount).toBe(1);

    const resumed = await runtime.resume(token);
    expect(resumed.instance.state).toBe(KnowledgeRuntimeState.RUNNING);
    expect(runtime.metrics().suspendedRuntimeCount).toBe(0);
    const types = publish.mock.calls.map((call) => call[0]?.type);
    expect(types).toContain(KnowledgeRuntimeEventType.SUSPENDED);
    expect(types).toContain(KnowledgeRuntimeEventType.RESUMED);
  });

  it("complete() records execution time and publishes COMPLETED", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const token = await createReadyInstance(runtime, asset.id);
    await runtime.start(token);
    const completed = await runtime.complete(token);
    expect(completed.instance.state).toBe(KnowledgeRuntimeState.COMPLETED);
    expect(runtime.metrics().averageExecutionTimeMs).toBeGreaterThanOrEqual(0);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.COMPLETED,
    );
  });

  it("fail() records failedRuntimeCount and publishes FAILED", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const token = await createReadyInstance(runtime, asset.id);
    await runtime.start(token);
    const failed = await runtime.fail(token, "execution error");
    expect(failed.instance.state).toBe(KnowledgeRuntimeState.FAILED);
    expect(runtime.metrics().failedRuntimeCount).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.FAILED,
    );
  });

  it("cancel() moves to CANCELLED and publishes CANCELLED", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    const cancelled = await runtime.cancel(execution.instance.token, "not needed");
    expect(cancelled.instance.state).toBe(KnowledgeRuntimeState.CANCELLED);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.CANCELLED,
    );
  });

  it("expire() moves to EXPIRED", async () => {
    const { runtime, asset } = await runtimeFixture();
    const token = await createReadyInstance(runtime, asset.id);
    const expired = await runtime.expire(token);
    expect(expired.instance.state).toBe(KnowledgeRuntimeState.EXPIRED);
  });

  it("destroy() unregisters the Instance and publishes DESTROYED", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    await runtime.cancel(execution.instance.token);
    await runtime.destroy(execution.instance.token);
    expect(runtime.getInstance(execution.instance.token)).toBeUndefined();
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.DESTROYED,
    );
  });

  it("an invalid Instance throws RuntimeValidationException and publishes VALIDATION_FAILED", async () => {
    const { runtime, asset, publish } = await runtimeFixture();
    const execution = await runtime.createInstance({
      knowledgeId: asset.id,
      tenantId: "tenant-1",
      metadata: { labels: ["dup", "dup"] },
    });

    await expect(runtime.load(execution.instance.token)).rejects.toThrow(
      RuntimeValidationException,
    );
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeRuntimeEventType.VALIDATION_FAILED,
    );
    expect(runtime.metrics().validationFailures).toBe(1);
  });

  it("getInstance()/requireInstance()/listInstances() expose the Manager's Registry", async () => {
    const { runtime, asset } = await runtimeFixture();
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    expect(runtime.requireInstance(execution.instance.token)).toBe(execution);
    expect(runtime.listInstances("tenant-1")).toHaveLength(1);
  });

  it("snapshot()/listSnapshots() delegate to the Manager", async () => {
    const { runtime, asset } = await runtimeFixture();
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    const snapshot = await runtime.snapshot(execution.instance.token);
    expect(runtime.listSnapshots(execution.instance.token)).toEqual([snapshot]);
  });

  it("replay() throws ReplayNotSupportedException when unconfigured", async () => {
    const { runtime, asset } = await runtimeFixture();
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    expect(() => runtime.replay(execution.instance.token)).toThrow(ReplayNotSupportedException);
  });

  it("replay() delegates to a configured IKnowledgeRuntimeReplay provider", async () => {
    const replayProvider = { replayInstance: vi.fn(async () => []) };
    const { runtime, asset } = await runtimeFixture({ replayProvider });
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    await runtime.replay(execution.instance.token);
    expect(replayProvider.replayInstance).toHaveBeenCalledWith(execution.instance.token);
  });

  it("health()/metrics()/monitorSnapshot() reflect current Runtime state", async () => {
    const { runtime, asset } = await runtimeFixture();
    await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    expect(runtime.health().status).toBe("healthy");
    expect(runtime.metrics().runtimeCount).toBe(1);
    expect(runtime.monitorSnapshot().runtime.count).toBe(1);
  });

  it("use() registers a custom Middleware that runs during every operation", async () => {
    const { runtime, asset } = await runtimeFixture();
    const calls: string[] = [];
    runtime.use({
      name: "custom",
      async execute(_context, next) {
        calls.push("custom");
        await next();
      },
    });
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    await runtime.cancel(execution.instance.token);
    expect(calls).toEqual(["custom"]);
  });

  it("exposes factory/manager/loader/resolver/validator/lifecycle/stateMachine", async () => {
    const { runtime } = await runtimeFixture();
    expect(runtime.factory).toBeDefined();
    expect(runtime.manager).toBeDefined();
    expect(runtime.loader).toBeDefined();
    expect(runtime.resolver).toBeDefined();
    expect(runtime.validator).toBeDefined();
    expect(runtime.lifecycle).toBeDefined();
    expect(runtime.stateMachine).toBeDefined();
  });

  it("respects allowedTenantIds from config", async () => {
    const { runtime, asset } = await runtimeFixture({ allowedTenantIds: ["only-this-tenant"] });
    const execution = await runtime.createInstance({ knowledgeId: asset.id, tenantId: "tenant-1" });
    await expect(runtime.load(execution.instance.token)).rejects.toThrow(
      RuntimeValidationException,
    );
  });
});
