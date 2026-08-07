import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityExecution } from "../../src/domain/knowledge-quality-execution.js";
import { QualityNotFoundException } from "../../src/errors/quality-not-found-exception.js";
import { KnowledgeQualityManager } from "../../src/manager/knowledge-quality-manager.js";
import type { KnowledgeQualityRegistryEntry } from "../../src/registry/knowledge-quality-registry-entry.js";
import { KnowledgeQualityRegistry } from "../../src/registry/knowledge-quality-registry.js";
import { KnowledgeQualitySession } from "../../src/session/knowledge-quality-session.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(token: string, assessmentId: string): KnowledgeQualityExecution {
  return {
    instance: {
      id: assessmentId,
      token,
      assessmentId,
      tenantId: "tenant-1",
      state: KnowledgeQualityAssessmentState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture({ assessmentId, token }),
    metadata: {
      assessmentId,
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      assessmentId,
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    resolvedRules: [],
    findings: [],
    scoreMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

function buildManager(): KnowledgeQualityManager {
  return new KnowledgeQualityManager(new KnowledgeQualityRegistry(), new KnowledgeQualitySession());
}

describe("KnowledgeQualityManager", () => {
  it("register() stores the execution and Registry entry", () => {
    const manager = buildManager();
    const execution = buildExecution("kqua_1", "g-1");
    const entry: KnowledgeQualityRegistryEntry = {
      id: "g-1",
      token: "kqua_1",
      metadata: execution.metadata,
    };
    manager.register("kqua_1", execution, entry);
    expect(manager.get("kqua_1")).toBe(execution);
    expect(manager.count()).toBe(1);
  });

  it("register() records requested statistics", () => {
    const manager = buildManager();
    const execution = buildExecution("kqua_1", "g-1");
    manager.register("kqua_1", execution, {
      id: "g-1",
      token: "kqua_1",
      metadata: execution.metadata,
    });
    expect(
      manager.statistics.get(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT).requestedCount,
    ).toBe(1);
  });

  it("get() returns undefined for an unknown token", () => {
    expect(buildManager().get("kqua_missing")).toBeUndefined();
  });

  it("require() throws QualityNotFoundException for an unknown token", () => {
    expect(() => buildManager().require("kqua_missing")).toThrow(QualityNotFoundException);
  });

  it("require() returns the execution for a known token", () => {
    const manager = buildManager();
    const execution = buildExecution("kqua_1", "g-1");
    manager.register("kqua_1", execution, {
      id: "g-1",
      token: "kqua_1",
      metadata: execution.metadata,
    });
    expect(manager.require("kqua_1")).toBe(execution);
  });

  it("update() replaces the stored execution", () => {
    const manager = buildManager();
    const execution = buildExecution("kqua_1", "g-1");
    manager.register("kqua_1", execution, {
      id: "g-1",
      token: "kqua_1",
      metadata: execution.metadata,
    });
    const updated = { ...execution, metadata: { ...execution.metadata, title: "Updated" } };
    manager.update("kqua_1", updated);
    expect(manager.get("kqua_1")?.metadata.title).toBe("Updated");
  });

  it("update() throws QualityNotFoundException for an unknown token", () => {
    const manager = buildManager();
    expect(() => manager.update("kqua_missing", buildExecution("kqua_missing", "g-x"))).toThrow(
      QualityNotFoundException,
    );
  });

  it("unregister() removes the execution and returns true", () => {
    const manager = buildManager();
    const execution = buildExecution("kqua_1", "g-1");
    manager.register("kqua_1", execution, {
      id: "g-1",
      token: "kqua_1",
      metadata: execution.metadata,
    });
    expect(manager.unregister("kqua_1")).toBe(true);
    expect(manager.get("kqua_1")).toBeUndefined();
  });

  it("unregister() returns false for an unknown token", () => {
    expect(buildManager().unregister("kqua_missing")).toBe(false);
  });

  it("list() returns every registered execution", () => {
    const manager = buildManager();
    const a = buildExecution("kqua_1", "g-1");
    const b = buildExecution("kqua_2", "g-2");
    manager.register("kqua_1", a, { id: "g-1", token: "kqua_1", metadata: a.metadata });
    manager.register("kqua_2", b, { id: "g-2", token: "kqua_2", metadata: b.metadata });
    expect(manager.list()).toHaveLength(2);
  });

  it("count() reflects the number of registered executions", () => {
    const manager = buildManager();
    expect(manager.count()).toBe(0);
    const execution = buildExecution("kqua_1", "g-1");
    manager.register("kqua_1", execution, {
      id: "g-1",
      token: "kqua_1",
      metadata: execution.metadata,
    });
    expect(manager.count()).toBe(1);
  });

  describe("Job Ledger", () => {
    it("registerJob() stores a job retrievable by getJob()", () => {
      const manager = buildManager();
      const job = manager.registerJob({
        id: "j-1",
        jobId: "j-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        priority: 5,
        createdAt: now,
      });
      expect(manager.getJob("j-1")).toBe(job);
    });

    it("getJob() returns undefined for an unknown jobId", () => {
      expect(buildManager().getJob("missing")).toBeUndefined();
    });

    it("requireJob() throws QualityNotFoundException for an unknown jobId", () => {
      expect(() => buildManager().requireJob("missing")).toThrow(QualityNotFoundException);
    });

    it("requireJob() returns the job for a known jobId", () => {
      const manager = buildManager();
      manager.registerJob({
        id: "j-1",
        jobId: "j-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        priority: 5,
        createdAt: now,
      });
      expect(manager.requireJob("j-1").jobId).toBe("j-1");
    });

    it("updateJob() replaces the stored job", () => {
      const manager = buildManager();
      manager.registerJob({
        id: "j-1",
        jobId: "j-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        priority: 5,
        createdAt: now,
      });
      const updated = manager.updateJob({
        id: "j-1",
        jobId: "j-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        priority: 1,
        createdAt: now,
      });
      expect(updated.priority).toBe(1);
      expect(manager.getJob("j-1")?.priority).toBe(1);
    });

    it("updateJob() throws QualityNotFoundException for an unknown jobId", () => {
      const manager = buildManager();
      expect(() =>
        manager.updateJob({
          id: "missing",
          jobId: "missing",
          assessmentId: "g-1",
          tenantId: "tenant-1",
          priority: 5,
          createdAt: now,
        }),
      ).toThrow(QualityNotFoundException);
    });

    it("listJobs() returns every registered job", () => {
      const manager = buildManager();
      manager.registerJob({
        id: "j-1",
        jobId: "j-1",
        assessmentId: "g-1",
        tenantId: "tenant-1",
        priority: 5,
        createdAt: now,
      });
      manager.registerJob({
        id: "j-2",
        jobId: "j-2",
        assessmentId: "g-2",
        tenantId: "tenant-1",
        priority: 5,
        createdAt: now,
      });
      expect(manager.listJobs()).toHaveLength(2);
    });
  });
});
