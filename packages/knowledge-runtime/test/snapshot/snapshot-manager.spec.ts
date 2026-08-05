import { describe, expect, it } from "vitest";

import { RuntimeSnapshotException } from "../../src/errors/runtime-snapshot-exception.js";
import { SnapshotManager } from "../../src/snapshot/snapshot-manager.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Snapshot Test — SnapshotManager", () => {
  it("capture() records a Snapshot per token in sequence order", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const manager = new SnapshotManager();
    const first = manager.capture(execution);
    const second = manager.capture(execution);
    expect(first.sequence).toBe(0);
    expect(second.sequence).toBe(1);
    expect(manager.list(execution.instance.token)).toHaveLength(2);
  });

  it("latest() returns the most recently captured Snapshot", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const manager = new SnapshotManager();
    manager.capture(execution);
    const second = manager.capture(execution);
    expect(manager.latest(execution.instance.token)).toBe(second);
  });

  it("latest() throws RuntimeSnapshotException when nothing was captured", () => {
    const manager = new SnapshotManager();
    expect(() => manager.latest("missing")).toThrow(RuntimeSnapshotException);
  });

  it("list() returns an empty array for an unknown token", () => {
    const manager = new SnapshotManager();
    expect(manager.list("missing")).toEqual([]);
  });
});
