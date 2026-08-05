import { describe, expect, it } from "vitest";

import { SnapshotException } from "../../src/errors/snapshot-exception.js";
import { SnapshotManager } from "../../src/snapshot/snapshot-manager.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Snapshot Test — SnapshotManager", () => {
  it("capture() stores a Snapshot with sequence 0 for a token's first capture", () => {
    const manager = new SnapshotManager();
    const execution = executionFixture();
    const snapshot = manager.capture(execution);
    expect(snapshot.sequence).toBe(0);
    expect(snapshot.instanceToken).toBe(execution.instance.token);
    expect(snapshot.instance).toEqual(execution.instance);
    expect(snapshot.context).toEqual(execution.context);
  });

  it("capture() increments sequence on repeated captures for the same token", () => {
    const manager = new SnapshotManager();
    const execution = executionFixture();
    manager.capture(execution);
    const second = manager.capture(execution);
    expect(second.sequence).toBe(1);
  });

  it("list() returns every captured Snapshot for a token, empty for an unknown one", () => {
    const manager = new SnapshotManager();
    const execution = executionFixture();
    manager.capture(execution);
    manager.capture(execution);
    expect(manager.list(execution.instance.token)).toHaveLength(2);
    expect(manager.list("wtok_ghost")).toEqual([]);
  });

  it("latest() returns the most recently captured Snapshot", () => {
    const manager = new SnapshotManager();
    const execution = executionFixture();
    manager.capture(execution);
    const second = manager.capture(execution);
    expect(manager.latest(execution.instance.token)).toBe(second);
  });

  it("latest() throws SnapshotException when nothing has been captured yet", () => {
    const manager = new SnapshotManager();
    expect(() => manager.latest("wtok_ghost")).toThrow(SnapshotException);
  });
});
