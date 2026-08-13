import { describe, expect, it } from "vitest";

import { TaskStatus } from "../../../src/domain/value-objects/TaskStatus.js";

describe("TaskStatus", () => {
  it("has exactly the 4 documented members", () => {
    expect(Object.values(TaskStatus).sort()).toEqual(
      ["FAILED", "GENERATING", "PENDING", "SUCCESS"].sort(),
    );
  });

  it("PENDING is a distinct value from GENERATING", () => {
    expect(TaskStatus.PENDING).not.toBe(TaskStatus.GENERATING);
  });
});
