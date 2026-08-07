import { describe, expect, it } from "vitest";

import { findDependencies, findDependents } from "../../src/reasoning/dependency-reasoner.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("findDependencies", () => {
  it("returns every transitive dependency (DependsOn/Uses/Calls/References descendants)", () => {
    const engine = buildDagEngine();
    expect(findDependencies(engine, "A").sort()).toEqual(["B", "C", "D"]);
  });

  it("a leaf node has no dependencies", () => {
    const engine = buildDagEngine();
    expect(findDependencies(engine, "D")).toEqual([]);
  });
});

describe("findDependents", () => {
  it("returns every transitive dependent (nodes that depend on this one)", () => {
    const engine = buildDagEngine();
    expect(findDependents(engine, "D").sort()).toEqual(["A", "B", "C"]);
  });

  it("a root node has no dependents", () => {
    const engine = buildDagEngine();
    expect(findDependents(engine, "A")).toEqual([]);
  });
});
