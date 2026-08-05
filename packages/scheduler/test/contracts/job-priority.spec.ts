import { describe, expect, it } from "vitest";

import { JOB_PRIORITY_ORDER, JobPriority } from "../../src/contracts/job-priority.js";

describe("Priority Test — JOB_PRIORITY_ORDER", () => {
  it("orders Critical first and Background last", () => {
    expect(JOB_PRIORITY_ORDER[0]).toBe(JobPriority.CRITICAL);
    expect(JOB_PRIORITY_ORDER[JOB_PRIORITY_ORDER.length - 1]).toBe(JobPriority.BACKGROUND);
  });

  it("contains every JobPriority value exactly once", () => {
    const values = Object.values(JobPriority);
    expect(new Set(JOB_PRIORITY_ORDER).size).toBe(values.length);
    for (const value of values) {
      expect(JOB_PRIORITY_ORDER).toContain(value);
    }
  });
});
