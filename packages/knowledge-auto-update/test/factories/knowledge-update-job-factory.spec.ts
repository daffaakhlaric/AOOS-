import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeUpdateJobFactory } from "../../src/factories/knowledge-update-job-factory.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { ScheduleKind } from "../../src/types/schedule-descriptor.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { resetIdCounters } from "../../src/utils/id-generator.js";

describe("KnowledgeUpdateJobFactory", () => {
  beforeEach(() => resetIdCounters());

  it("creates a job with sensible defaults", () => {
    const factory = new KnowledgeUpdateJobFactory();
    const job = factory.create({ targetId: "target-1", policyId: "policy-1" }, 100);
    expect(job.updateType).toBe(KnowledgeUpdateType.Manual);
    expect(job.schedule).toEqual({ kind: ScheduleKind.Immediate });
    expect(job.status).toBe(KnowledgeUpdateJobStatus.Pending);
    expect(job.priority).toBe(0);
    expect(job.attempt).toBe(0);
    expect(job.createdAt).toBe(100);
    expect(job.updatedAt).toBe(100);
  });

  it("generates unique, prefixed ids", () => {
    const factory = new KnowledgeUpdateJobFactory();
    const a = factory.create({ targetId: "t", policyId: "p" }, 0);
    const b = factory.create({ targetId: "t", policyId: "p" }, 0);
    expect(a.id).toBe("job_1");
    expect(b.id).toBe("job_2");
  });

  it("creates a job with an empty payload by default", () => {
    const factory = new KnowledgeUpdateJobFactory();
    const job = factory.create({ targetId: "t", policyId: "p" }, 0);
    expect(job.payload).toEqual({});
    expect(job.previousPayload).toBeUndefined();
  });

  it("honors explicit overrides", () => {
    const factory = new KnowledgeUpdateJobFactory();
    const job = factory.create(
      {
        targetId: "t",
        policyId: "p",
        updateType: KnowledgeUpdateType.Version,
        dependsOn: ["job_1"],
        payload: { version: "1.0.0" },
        priority: 5,
      },
      0,
    );
    expect(job.updateType).toBe(KnowledgeUpdateType.Version);
    expect(job.dependsOn).toEqual(["job_1"]);
    expect(job.payload).toEqual({ version: "1.0.0" });
    expect(job.priority).toBe(5);
  });
});
