import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeManager } from "../../src/manager/knowledge-runtime-manager.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Manager Test — KnowledgeRuntimeManager", () => {
  it("register()/get()/require()/list()/count() delegate to the Registry", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const manager = new KnowledgeRuntimeManager();
    manager.register(execution);
    expect(manager.get(execution.instance.token)).toBe(execution);
    expect(manager.require(execution.instance.token)).toBe(execution);
    expect(manager.list()).toHaveLength(1);
    expect(manager.count()).toBe(1);
  });

  it("unregister() removes the Execution", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const manager = new KnowledgeRuntimeManager();
    manager.register(execution);
    manager.unregister(execution.instance.token);
    expect(manager.get(execution.instance.token)).toBeUndefined();
  });

  it("snapshot()/listSnapshots()/latestSnapshot() delegate to the SnapshotManager", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const manager = new KnowledgeRuntimeManager();
    manager.register(execution);
    const snapshot = manager.snapshot(execution.instance.token);
    expect(manager.listSnapshots(execution.instance.token)).toEqual([snapshot]);
    expect(manager.latestSnapshot(execution.instance.token)).toBe(snapshot);
  });

  it("openSession()/closeSession()/suspendSession()/resumeSession()/renewSession()/expireSession()/destroySession() delegate to the Session engine", () => {
    const manager = new KnowledgeRuntimeManager();
    manager.openSession("ktok_1", "user-1");
    manager.suspendSession("ktok_1");
    manager.resumeSession("ktok_1");
    manager.renewSession("ktok_1");
    const closed = manager.closeSession("ktok_1");
    expect(closed.state).toBe("closed");

    manager.openSession("ktok_2", "user-1");
    const expired = manager.expireSession("ktok_2");
    expect(expired.state).toBe("expired");

    manager.openSession("ktok_3", "user-1");
    manager.destroySession("ktok_3");
    expect(manager.session.get("ktok_3")).toBeUndefined();
  });
});
