import { describe, expect, it } from "vitest";

import { DependencyCycleException } from "../../src/errors/dependency-cycle-exception.js";
import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";

describe("DependencyCycleException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new DependencyCycleException(["a", "b"])).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code DEPENDENCY_CYCLE", () => {
    expect(new DependencyCycleException(["a"]).code).toBe("DEPENDENCY_CYCLE");
  });

  it("lists the cyclic nodes in the message and context", () => {
    const error = new DependencyCycleException(["a", "b", "c"]);
    expect(error.message).toContain("a, b, c");
    expect(error.context).toEqual({ nodes: ["a", "b", "c"] });
  });
});
