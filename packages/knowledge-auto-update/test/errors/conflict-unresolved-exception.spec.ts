import { describe, expect, it } from "vitest";

import { ConflictUnresolvedException } from "../../src/errors/conflict-unresolved-exception.js";
import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";

describe("ConflictUnresolvedException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new ConflictUnresolvedException("job-1", "no candidates")).toBeInstanceOf(
      KnowledgeAutoUpdateException,
    );
  });

  it("sets code CONFLICT_UNRESOLVED", () => {
    expect(new ConflictUnresolvedException("job-1", "x").code).toBe("CONFLICT_UNRESOLVED");
  });

  it("includes jobId and reason", () => {
    const error = new ConflictUnresolvedException("job-9", "missing version");
    expect(error.message).toContain("job-9");
    expect(error.message).toContain("missing version");
    expect(error.context).toEqual({ jobId: "job-9", reason: "missing version" });
  });
});
