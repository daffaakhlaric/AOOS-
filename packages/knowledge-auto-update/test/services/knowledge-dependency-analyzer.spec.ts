import { beforeEach, describe, expect, it } from "vitest";

import { DependencyCycleException } from "../../src/errors/dependency-cycle-exception.js";
import { KnowledgeDependencyAnalyzer } from "../../src/services/knowledge-dependency-analyzer.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";

describe("KnowledgeDependencyAnalyzer", () => {
  beforeEach(resetFixtureState);
  const analyzer = new KnowledgeDependencyAnalyzer();

  it("orders independent jobs with no dependencies", () => {
    const jobs = [makeJob({ id: "a" }), makeJob({ id: "b" })];
    expect(analyzer.order(jobs)).toEqual(["a", "b"]);
  });

  it("orders a dependency chain correctly", () => {
    const jobs = [
      makeJob({ id: "c", dependsOn: ["b"] }),
      makeJob({ id: "b", dependsOn: ["a"] }),
      makeJob({ id: "a" }),
    ];
    expect(analyzer.order(jobs)).toEqual(["a", "b", "c"]);
  });

  it("ignores dependencies outside the given batch", () => {
    const jobs = [makeJob({ id: "a", dependsOn: ["external-job-not-in-batch"] })];
    expect(analyzer.order(jobs)).toEqual(["a"]);
  });

  it("throws DependencyCycleException for a cyclic batch", () => {
    const jobs = [makeJob({ id: "a", dependsOn: ["b"] }), makeJob({ id: "b", dependsOn: ["a"] })];
    expect(() => analyzer.order(jobs)).toThrow(DependencyCycleException);
  });

  it("handles an empty batch", () => {
    expect(analyzer.order([])).toEqual([]);
  });

  it("orders a diamond graph respecting both parent branches before the sink", () => {
    const jobs = [
      makeJob({ id: "d", dependsOn: ["b", "c"] }),
      makeJob({ id: "b", dependsOn: ["a"] }),
      makeJob({ id: "c", dependsOn: ["a"] }),
      makeJob({ id: "a" }),
    ];
    const order = analyzer.order(jobs);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("c"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"));
  });
});
