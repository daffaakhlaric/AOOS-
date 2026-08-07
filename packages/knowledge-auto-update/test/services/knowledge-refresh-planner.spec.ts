import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeRefreshPlanner } from "../../src/services/knowledge-refresh-planner.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";

describe("KnowledgeRefreshPlanner", () => {
  beforeEach(resetFixtureState);
  const planner = new KnowledgeRefreshPlanner();

  it("plans steps in dependency order with sequence numbers", () => {
    const jobs = [
      makeJob({ id: "b", targetId: "target-b", dependsOn: ["a"] }),
      makeJob({ id: "a", targetId: "target-a" }),
    ];
    const plan = planner.plan(jobs);
    expect(plan.steps.map((s) => s.jobId)).toEqual(["a", "b"]);
    expect(plan.steps.map((s) => s.sequence)).toEqual([0, 1]);
    expect(plan.steps[0]!.targetId).toBe("target-a");
  });

  it("plans an empty batch as an empty plan", () => {
    expect(planner.plan([]).steps).toEqual([]);
  });

  it("plans independent jobs preserving input order", () => {
    const jobs = [makeJob({ id: "x" }), makeJob({ id: "y" })];
    const plan = planner.plan(jobs);
    expect(plan.steps.map((s) => s.jobId)).toEqual(["x", "y"]);
  });

  it("plans a 3-level chain with strictly increasing sequence numbers", () => {
    const jobs = [
      makeJob({ id: "c", dependsOn: ["b"] }),
      makeJob({ id: "b", dependsOn: ["a"] }),
      makeJob({ id: "a" }),
    ];
    const plan = planner.plan(jobs);
    expect(plan.steps.map((s) => s.sequence)).toEqual([0, 1, 2]);
    expect(plan.steps.map((s) => s.jobId)).toEqual(["a", "b", "c"]);
  });
});
