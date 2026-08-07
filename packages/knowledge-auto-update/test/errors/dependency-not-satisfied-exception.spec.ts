import { describe, expect, it } from "vitest";

import { DependencyNotSatisfiedException } from "../../src/errors/dependency-not-satisfied-exception.js";
import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";

describe("DependencyNotSatisfiedException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new DependencyNotSatisfiedException("job-1", ["dep-1"])).toBeInstanceOf(
      KnowledgeAutoUpdateException,
    );
  });

  it("sets code DEPENDENCY_NOT_SATISFIED", () => {
    expect(new DependencyNotSatisfiedException("job-1", ["dep-1"]).code).toBe(
      "DEPENDENCY_NOT_SATISFIED",
    );
  });

  it("lists blocked-on dependencies in message and context", () => {
    const error = new DependencyNotSatisfiedException("job-3", ["dep-a", "dep-b"]);
    expect(error.message).toContain("job-3");
    expect(error.message).toContain("dep-a, dep-b");
    expect(error.context).toEqual({ jobId: "job-3", blockedOn: ["dep-a", "dep-b"] });
  });
});
