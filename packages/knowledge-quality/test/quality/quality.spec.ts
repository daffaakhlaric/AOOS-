import { describe, expect, it, vi } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import { KnowledgeQualitySessionState } from "../../src/domain/knowledge-quality-session-state.js";
import { QualityNotFoundException } from "../../src/errors/quality-not-found-exception.js";
import { KnowledgeQualityEventType } from "../../src/events/knowledge-quality-event-type.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { createDraftAssessment, qualityFixture } from "../helpers/quality-fixture.js";

describe("KnowledgeQuality — Assessment Operations", () => {
  it("createAssessment() produces a Draft Assessment", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    const record = quality.require(token);
    expect(record.state).toBe(KnowledgeQualityAssessmentState.DRAFT);
  });

  it("createAssessment() publishes AssessmentCreated", async () => {
    const { quality, publish } = qualityFixture();
    await createDraftAssessment(quality);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.ASSESSMENT_CREATED }),
    );
  });

  it("queue() drives Draft -> Queued and publishes AssessmentQueued", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    const record = await quality.queue({ token });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.QUEUED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.ASSESSMENT_QUEUED }),
    );
  });

  it("prepare() drives Queued -> Preparing", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    const record = await quality.prepare({ token });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.PREPARING);
  });

  it("start() drives Preparing -> Assessing and publishes AssessmentStarted", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    const record = await quality.start({ token });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.ASSESSING);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.ASSESSMENT_STARTED }),
    );
  });

  it("start() invokes a registered IKnowledgeQualityProvider and records the returned Findings", async () => {
    const provider = {
      assess: vi.fn(async () => ({
        findings: [
          {
            dimension: KnowledgeQualityDimension.ACCURACY,
            severity: "high" as const,
            description: "found an issue",
          },
        ],
      })),
    };
    const { quality } = qualityFixture({ provider });
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    const record = await quality.start({ token });
    expect(provider.assess).toHaveBeenCalledTimes(1);
    expect(record.findings).toHaveLength(1);
    expect(record.findings[0]?.dimension).toBe(KnowledgeQualityDimension.ACCURACY);
  });

  it("start() never invokes a provider when none is registered", async () => {
    const { quality } = qualityFixture();
    expect(quality.hasProvider()).toBe(false);
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    const record = await quality.start({ token });
    expect(record.findings).toEqual([]);
  });

  it("complete() drives Reviewing -> Completed and records statistics/metrics", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    await quality.start({ token });
    await quality.review({ token });
    const record = await quality.complete({ token });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.COMPLETED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.ASSESSMENT_COMPLETED }),
    );
    expect(quality.metrics.snapshot().completedCount).toBe(1);
    expect(
      quality.statistics.get(KnowledgeQualityAssessmentMode.FULL_ASSESSMENT).completedCount,
    ).toBe(1);
  });

  it("complete() records a real average duration once startedAt/completedAt are stamped", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    await quality.start({ token });
    await quality.review({ token });
    await quality.complete({ token });
    expect(quality.metrics.snapshot().averageDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("fail() drives to Failed, records failedCount, and publishes AssessmentFailed", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    const record = await quality.fail({ token, reason: "provider error" });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.FAILED);
    expect(quality.metrics.snapshot().failedCount).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.ASSESSMENT_FAILED }),
    );
  });

  it("cancel() drives to Cancelled from Draft and publishes AssessmentCancelled", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    const record = await quality.cancel({ token });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.CANCELLED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.ASSESSMENT_CANCELLED }),
    );
  });

  it("archive() drives a settled Assessment to Archived and publishes AssessmentArchived", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.fail({ token, reason: "x" });
    const record = await quality.archive({ token });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.ARCHIVED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.ASSESSMENT_ARCHIVED }),
    );
  });

  it("destroy() drives to Destroyed (terminal) and publishes AssessmentDestroyed", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.cancel({ token });
    const record = await quality.destroy({ token });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.DESTROYED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.ASSESSMENT_DESTROYED }),
    );
  });

  it("every Lifecycle state is reachable from Draft through facade operations, and Destroyed has no legal next operation", async () => {
    const { quality } = qualityFixture();

    const token = await createDraftAssessment(quality);
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.DRAFT);
    await quality.queue({ token });
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.QUEUED);
    await quality.prepare({ token });
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.PREPARING);
    await quality.start({ token });
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.ASSESSING);
    await quality.review({ token });
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.REVIEWING);
    await quality.complete({ token });
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.COMPLETED);
    await quality.archive({ token });
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.ARCHIVED);
    await quality.destroy({ token });
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.DESTROYED);

    await expect(quality.queue({ token })).rejects.toThrow();
    await expect(quality.archive({ token })).rejects.toThrow();
  });

  it("operations against an unknown token throw QualityNotFoundException", async () => {
    const { quality } = qualityFixture();
    await expect(quality.queue({ token: "kqua_missing" })).rejects.toThrow(
      QualityNotFoundException,
    );
  });
});

describe("KnowledgeQuality — Provider Resolution", () => {
  it("hasProvider()/hasScoringProvider() reflect config presence at construction time", () => {
    const { quality } = qualityFixture({
      provider: { assess: vi.fn(async () => ({ findings: [] })) },
    });
    expect(quality.hasProvider()).toBe(true);
    expect(quality.hasScoringProvider()).toBe(false);
  });

  it("createAssessment()/queue()/prepare() succeed with no provider ever configured", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await expect(quality.prepare({ token })).resolves.toBeDefined();
  });
});

describe("KnowledgeQuality — Rule Operations", () => {
  it("registerRule() makes a Rule id resolvable by createAssessment()", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality, { withRule: true });
    const record = quality.require(token);
    expect(record.request.ruleIds.length).toBeGreaterThan(0);
  });

  it("createAssessment() with an unregistered Rule id fails validation", async () => {
    const { quality } = qualityFixture();
    const context = contextFixture({ assessmentId: "g-x" });
    await expect(
      quality.createAssessment({
        context,
        title: "Title",
        mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
        targetReference: "target-1",
        ruleIds: ["missing-rule"],
        requestedBy: "user-1",
      }),
    ).rejects.toThrow();
  });
});

describe("KnowledgeQuality — Profile Operations", () => {
  it("registerProfile() makes a Profile resolvable and attached by the Pipeline", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality, { withRule: true, withProfile: true });
    const record = quality.require(token);
    expect(record.profile).toBeDefined();
  });

  it("createAssessment() with an unregistered Profile id fails validation", async () => {
    const { quality } = qualityFixture();
    const context = contextFixture({ assessmentId: "g-x" });
    await expect(
      quality.createAssessment({
        context,
        title: "Title",
        mode: KnowledgeQualityAssessmentMode.CUSTOM,
        targetReference: "target-1",
        profileId: "missing-profile",
        requestedBy: "user-1",
      }),
    ).rejects.toThrow();
  });
});

describe("KnowledgeQuality — Configuration Operations", () => {
  it("registerConfiguration() makes a Configuration resolvable and attached by the Pipeline", async () => {
    const { quality } = qualityFixture();
    const configurationId = "cfg-op-1";
    quality.registerConfiguration({
      configurationId,
      assessmentId: "g-1",
      tenantId: "tenant-1",
    });
    const context = contextFixture({ assessmentId: "g-cfg", tenantId: "tenant-1" });
    const record = await quality.createAssessment({
      context,
      title: "Title",
      mode: KnowledgeQualityAssessmentMode.CUSTOM,
      targetReference: "target-1",
      configurationId,
      requestedBy: "user-1",
    });
    expect(record.configuration?.configurationId).toBe(configurationId);
  });
});

describe("KnowledgeQuality — Session Operations", () => {
  it("openSession() opens a Session in OPEN state", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    const session = quality.openSession({ token, holder: "user-1" });
    expect(session.state).toBe(KnowledgeQualitySessionState.OPEN);
  });

  it("closeSession() transitions to CLOSED", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    quality.openSession({ token, holder: "user-1" });
    const closed = quality.closeSession({ token });
    expect(closed.state).toBe(KnowledgeQualitySessionState.CLOSED);
  });

  it("cancelSession() transitions to CANCELLED", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    quality.openSession({ token, holder: "user-1" });
    const cancelled = quality.cancelSession({ token });
    expect(cancelled.state).toBe(KnowledgeQualitySessionState.CANCELLED);
  });

  it("expireSession() transitions to EXPIRED", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    quality.openSession({ token, holder: "user-1" });
    const expired = quality.expireSession({ token });
    expect(expired.state).toBe(KnowledgeQualitySessionState.EXPIRED);
  });

  it("renewSession() extends expiresAt while staying OPEN", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    const opened = quality.openSession({ token, holder: "user-1", ttlMs: 1000 });
    const renewed = quality.renewSession({ token, ttlMs: 999999 });
    expect(renewed.expiresAt).toBeDefined();
    expect(Date.parse(renewed.expiresAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(opened.expiresAt ?? ""),
    );
  });

  it("openSession() throws for an unknown Assessment token", () => {
    const { quality } = qualityFixture();
    expect(() => quality.openSession({ token: "kqua_missing", holder: "user-1" })).toThrow(
      QualityNotFoundException,
    );
  });
});

describe("KnowledgeQuality — Job Operations", () => {
  it("createJob() registers a Job with default priority", async () => {
    const { quality } = qualityFixture();
    const { job } = quality.createJob({ assessmentId: "g-1", tenantId: "tenant-1" });
    expect(job.priority).toBe(5);
  });

  it("createJob() honors a caller-supplied priority", () => {
    const { quality } = qualityFixture();
    const { job } = quality.createJob({ assessmentId: "g-1", tenantId: "tenant-1", priority: 1 });
    expect(job.priority).toBe(1);
  });

  it("completeJob() stamps completedAt", () => {
    const { quality } = qualityFixture();
    const { job } = quality.createJob({ assessmentId: "g-1", tenantId: "tenant-1" });
    const completed = quality.completeJob({ jobId: job.jobId });
    expect(completed.completedAt).toBeDefined();
  });

  it("failJob() stamps failedAt/failureReason", () => {
    const { quality } = qualityFixture();
    const { job } = quality.createJob({ assessmentId: "g-1", tenantId: "tenant-1" });
    const failed = quality.failJob({ jobId: job.jobId, reason: "timeout" });
    expect(failed.failedAt).toBeDefined();
    expect(failed.failureReason).toBe("timeout");
  });

  it("completeJob() throws for an unknown jobId", () => {
    const { quality } = qualityFixture();
    expect(() => quality.completeJob({ jobId: "missing" })).toThrow(QualityNotFoundException);
  });
});

describe("KnowledgeQuality — Finding Operations", () => {
  it("recordFinding() attaches a Finding to an Assessing Assessment and publishes FindingCreated", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    await quality.start({ token });
    const record = await quality.recordFinding({
      token,
      dimension: KnowledgeQualityDimension.CLARITY,
      severity: "medium",
      description: "unclear phrasing",
    });
    expect(record.findings).toHaveLength(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.FINDING_CREATED }),
    );
  });

  it("recordFinding() also succeeds while Reviewing", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    await quality.start({ token });
    await quality.review({ token });
    const record = await quality.recordFinding({
      token,
      dimension: KnowledgeQualityDimension.STRUCTURE,
      severity: "low",
      description: "structural nit",
    });
    expect(record.findings).toHaveLength(1);
  });

  it("recordFinding() throws while still Draft", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await expect(
      quality.recordFinding({
        token,
        dimension: KnowledgeQualityDimension.ACCURACY,
        severity: "low",
        description: "too early",
      }),
    ).rejects.toThrow();
  });
});

describe("KnowledgeQuality — Report Operations", () => {
  it("generateReport() publishes ReportGenerated and returns a Report", async () => {
    const { quality, publish } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    await quality.start({ token });
    const { report } = await quality.generateReport({ token });
    expect(report.assessmentId).toBeDefined();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeQualityEventType.REPORT_GENERATED }),
    );
  });
});

describe("KnowledgeQuality — Read Operations & Middleware", () => {
  it("get() returns undefined for an unknown token", () => {
    const { quality } = qualityFixture();
    expect(quality.get("kqua_missing")).toBeUndefined();
  });

  it("list()/count() reflect registered Assessments", async () => {
    const { quality } = qualityFixture();
    await createDraftAssessment(quality);
    await createDraftAssessment(quality);
    expect(quality.count()).toBe(2);
    expect(quality.list().assessments).toHaveLength(2);
  });

  it("use() registers a middleware invoked on every pipeline run", async () => {
    const { quality } = qualityFixture();
    const seen: string[] = [];
    quality.use(async (execution, next) => {
      seen.push(execution.metadata.assessmentId);
      await next();
    });
    await createDraftAssessment(quality);
    expect(seen).toHaveLength(1);
  });

  it("registerPolicy() registers a resolvable Policy", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality, {
      withPolicy: true,
      policyId: "policy-x",
    });
    const record = quality.require(token);
    expect(record.policy?.policyId).toBe("policy-x");
  });
});
