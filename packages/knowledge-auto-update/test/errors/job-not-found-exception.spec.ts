import { describe, expect, it } from "vitest";

import { JobNotFoundException } from "../../src/errors/job-not-found-exception.js";
import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";

describe("JobNotFoundException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new JobNotFoundException("job-1")).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code JOB_NOT_FOUND", () => {
    expect(new JobNotFoundException("job-1").code).toBe("JOB_NOT_FOUND");
  });

  it("includes the job id in the message and context", () => {
    const error = new JobNotFoundException("job-42");
    expect(error.message).toContain("job-42");
    expect(error.context).toEqual({ jobId: "job-42" });
  });
});
