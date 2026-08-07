import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { UpdateWindowClosedException } from "../../src/errors/update-window-closed-exception.js";

describe("UpdateWindowClosedException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new UpdateWindowClosedException("job-1", 3)).toBeInstanceOf(
      KnowledgeAutoUpdateException,
    );
  });

  it("sets code UPDATE_WINDOW_CLOSED", () => {
    expect(new UpdateWindowClosedException("job-1", 3).code).toBe("UPDATE_WINDOW_CLOSED");
  });

  it("includes jobId and hourUtc", () => {
    const error = new UpdateWindowClosedException("job-2", 14);
    expect(error.message).toContain("job-2");
    expect(error.message).toContain("14");
    expect(error.context).toEqual({ jobId: "job-2", hourUtc: 14 });
  });
});
