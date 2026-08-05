import { describe, expect, it } from "vitest";

import { createNodeSnapshot } from "../../src/instance/node-snapshot.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("createNodeSnapshot", () => {
  it("captures the current NodeExecution with a fresh id and timestamp", () => {
    const execution = executionFixture();
    const snapshot = createNodeSnapshot(execution);
    expect(snapshot.nodeInstanceId).toBe(execution.instance.id);
    expect(snapshot.execution).toBe(execution);
    expect(snapshot.id).toBeTruthy();
    expect(new Date(snapshot.capturedAt).toString()).not.toBe("Invalid Date");
  });
});
