import { describe, expect, it } from "vitest";

import { InvalidScheduleException } from "../../src/errors/invalid-schedule-exception.js";
import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";

describe("InvalidScheduleException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new InvalidScheduleException("bad")).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code INVALID_SCHEDULE", () => {
    expect(new InvalidScheduleException("bad").code).toBe("INVALID_SCHEDULE");
  });

  it("includes the reason in the message and forwards context", () => {
    const error = new InvalidScheduleException("interval must be positive", { jobId: "j-1" });
    expect(error.message).toContain("interval must be positive");
    expect(error.context).toEqual({ jobId: "j-1" });
  });
});
