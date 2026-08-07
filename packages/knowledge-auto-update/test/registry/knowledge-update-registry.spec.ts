import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeUpdateHistory } from "../../src/entities/knowledge-update-history.js";
import { KnowledgeUpdateReport } from "../../src/entities/knowledge-update-report.js";
import { KnowledgeUpdateResult } from "../../src/entities/knowledge-update-result.js";
import { KnowledgeUpdateSession } from "../../src/entities/knowledge-update-session.js";
import { KnowledgeUpdateTask } from "../../src/entities/knowledge-update-task.js";
import { JobNotFoundException } from "../../src/errors/job-not-found-exception.js";
import { PolicyNotFoundException } from "../../src/errors/policy-not-found-exception.js";
import { ReportNotFoundException } from "../../src/errors/report-not-found-exception.js";
import { SessionNotFoundException } from "../../src/errors/session-not-found-exception.js";
import { TaskNotFoundException } from "../../src/errors/task-not-found-exception.js";
import { KnowledgeUpdateRegistry } from "../../src/registry/knowledge-update-registry.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { KnowledgeUpdateReportType } from "../../src/types/report-type.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeJob, makePolicy, resetFixtureState } from "../helpers/fixtures.js";

describe("KnowledgeUpdateRegistry", () => {
  beforeEach(resetFixtureState);

  describe("jobs", () => {
    it("puts and gets a job by id", () => {
      const registry = new KnowledgeUpdateRegistry();
      const job = makeJob({ id: "job-1" });
      registry.putJob(job);
      expect(registry.getJob("job-1")).toBe(job);
    });

    it("throws JobNotFoundException for unknown id", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(() => registry.getJob("missing")).toThrow(JobNotFoundException);
    });

    it("findJob returns undefined for unknown id", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(registry.findJob("missing")).toBeUndefined();
    });

    it("hasJob reports presence correctly", () => {
      const registry = new KnowledgeUpdateRegistry();
      registry.putJob(makeJob({ id: "job-1" }));
      expect(registry.hasJob("job-1")).toBe(true);
      expect(registry.hasJob("job-2")).toBe(false);
    });

    it("removeJob deletes the job", () => {
      const registry = new KnowledgeUpdateRegistry();
      registry.putJob(makeJob({ id: "job-1" }));
      registry.removeJob("job-1");
      expect(registry.hasJob("job-1")).toBe(false);
    });

    it("putJob overwrites an existing job with the same id", () => {
      const registry = new KnowledgeUpdateRegistry();
      const job = makeJob({ id: "job-1", priority: 1 });
      registry.putJob(job);
      const updated = job.withPriority(99, 0);
      registry.putJob(updated);
      expect(registry.getJob("job-1").priority).toBe(99);
      expect(registry.listJobs()).toHaveLength(1);
    });

    it("listJobs returns all jobs", () => {
      const registry = new KnowledgeUpdateRegistry();
      registry.putJob(makeJob({ id: "job-1" }));
      registry.putJob(makeJob({ id: "job-2" }));
      expect(registry.listJobs()).toHaveLength(2);
    });
  });

  describe("tasks", () => {
    it("puts and gets a task by id", () => {
      const registry = new KnowledgeUpdateRegistry();
      const task = new KnowledgeUpdateTask({
        id: "task-1",
        jobId: "job-1",
        sessionId: "s-1",
        updateType: KnowledgeUpdateType.Manual,
        targetId: "target-1",
        payload: {},
        previousPayload: undefined,
        attempt: 0,
        createdAt: 0,
      });
      registry.putTask(task);
      expect(registry.getTask("task-1")).toBe(task);
    });

    it("throws TaskNotFoundException for unknown id", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(() => registry.getTask("missing")).toThrow(TaskNotFoundException);
    });

    it("listTasks returns all tasks", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(registry.listTasks()).toEqual([]);
    });
  });

  describe("results", () => {
    it("puts and gets a result by id", () => {
      const registry = new KnowledgeUpdateRegistry();
      const result = new KnowledgeUpdateResult({
        id: "result-1",
        taskId: "task-1",
        jobId: "job-1",
        success: true,
        appliedPayload: {},
        errorMessage: undefined,
        durationMs: 0,
        completedAt: 0,
      });
      registry.putResult(result);
      expect(registry.getResult("result-1")).toBe(result);
    });

    it("getResult returns undefined for unknown id", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(registry.getResult("missing")).toBeUndefined();
    });

    it("listResults returns all results", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(registry.listResults()).toEqual([]);
    });
  });

  describe("sessions", () => {
    it("puts and gets a session by id", () => {
      const registry = new KnowledgeUpdateRegistry();
      const session = new KnowledgeUpdateSession({
        id: "s-1",
        taskIds: [],
        resultIds: [],
        startedAt: 0,
        completedAt: undefined,
      });
      registry.putSession(session);
      expect(registry.getSession("s-1")).toBe(session);
    });

    it("throws SessionNotFoundException for unknown id", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(() => registry.getSession("missing")).toThrow(SessionNotFoundException);
    });

    it("listSessions returns all sessions", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(registry.listSessions()).toEqual([]);
    });
  });

  describe("reports", () => {
    it("puts and gets a report by id", () => {
      const registry = new KnowledgeUpdateRegistry();
      const report = new KnowledgeUpdateReport({
        id: "r-1",
        type: KnowledgeUpdateReportType.UpdateSummary,
        generatedAt: 0,
        data: {},
      });
      registry.putReport(report);
      expect(registry.getReport("r-1")).toBe(report);
    });

    it("throws ReportNotFoundException for unknown id", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(() => registry.getReport("missing")).toThrow(ReportNotFoundException);
    });

    it("listReports returns all reports", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(registry.listReports()).toEqual([]);
    });
  });

  describe("policies", () => {
    it("puts and gets a policy by id", () => {
      const registry = new KnowledgeUpdateRegistry();
      const policy = makePolicy();
      registry.putPolicy(policy);
      expect(registry.getPolicy(policy.id)).toBe(policy);
    });

    it("throws PolicyNotFoundException for unknown id", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(() => registry.getPolicy("missing")).toThrow(PolicyNotFoundException);
    });

    it("listPolicies returns all policies", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(registry.listPolicies()).toEqual([]);
    });
  });

  describe("cross-bucket isolation", () => {
    it("jobs, tasks, results, sessions, reports, and policies are independent id spaces", () => {
      const registry = new KnowledgeUpdateRegistry();
      const sharedId = "shared-id";
      registry.putJob(makeJob({ id: sharedId }));
      registry.putPolicy(makePolicy());
      expect(registry.hasJob(sharedId)).toBe(true);
      expect(() => registry.getTask(sharedId)).toThrow(TaskNotFoundException);
    });
  });

  describe("history", () => {
    it("putHistory/getHistory round-trips by jobId", () => {
      const registry = new KnowledgeUpdateRegistry();
      const history = KnowledgeUpdateHistory.empty("job-1").withEntry({
        status: KnowledgeUpdateJobStatus.Pending,
        at: 0,
        reason: undefined,
      });
      registry.putHistory(history);
      expect(registry.getHistory("job-1")).toBe(history);
    });

    it("getHistory returns undefined when absent", () => {
      const registry = new KnowledgeUpdateRegistry();
      expect(registry.getHistory("missing")).toBeUndefined();
    });
  });
});
