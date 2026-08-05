import { describe, expect, it } from "vitest";

import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { createJobInputFixture } from "../helpers/create-job-input-fixture.js";

describe("Dependency Test — DependencyValidator", () => {
  it("passes non-Dependency schedules unconditionally", () => {
    expect(new DependencyValidator().validate(createJobInputFixture(), {}).valid).toBe(true);
  });

  it("passes when every dependency id is known", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["a", "b"] },
    });
    const result = new DependencyValidator().validate(input, {
      existingJobIds: new Set(["a", "b"]),
    });
    expect(result.valid).toBe(true);
  });

  it("flags every unknown dependency id", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["a", "ghost"] },
    });
    const result = new DependencyValidator().validate(input, { existingJobIds: new Set(["a"]) });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("ghost");
  });

  it("Cycle Detection: rejects a dependency that would create a direct cycle", () => {
    // "b" already depends on the candidate ("candidate" is the placeholder id used when
    // no candidateJobId is supplied) — candidate depending on "b" would close the loop.
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["b"] },
    });
    const result = new DependencyValidator().validate(input, {
      existingJobIds: new Set(["b"]),
      existingDependenciesByJobId: new Map([["b", ["__candidate__"]]]),
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("Circular dependency");
  });

  it("Cycle Detection: rejects a longer chain cycle (a -> b -> candidate -> a)", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["a"] },
    });
    const result = new DependencyValidator().validate(input, {
      existingJobIds: new Set(["a", "b"]),
      existingDependenciesByJobId: new Map([
        ["a", ["b"]],
        ["b", ["__candidate__"]],
      ]),
    });
    expect(result.valid).toBe(false);
  });

  it("Cycle Detection: uses candidateJobId when updating an existing job", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["b"] },
    });
    const result = new DependencyValidator().validate(input, {
      existingJobIds: new Set(["b"]),
      existingDependenciesByJobId: new Map([["b", ["job-1"]]]),
      candidateJobId: "job-1",
    });
    expect(result.valid).toBe(false);
  });

  it("allows a non-cyclic chain", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.DEPENDENCY, timezone: "UTC", dependsOnJobIds: ["a"] },
    });
    const result = new DependencyValidator().validate(input, {
      existingJobIds: new Set(["a", "b"]),
      existingDependenciesByJobId: new Map([["a", ["b"]]]),
    });
    expect(result.valid).toBe(true);
  });
});
