import { describe, expect, it, vi } from "vitest";

import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import { QualityNotFoundException } from "../../src/errors/quality-not-found-exception.js";
import { createDraftAssessment, qualityFixture } from "../helpers/quality-fixture.js";

describe("KnowledgeQuality — additional facade edge cases", () => {
  it("registerRule() returns the created Rule", () => {
    const { quality } = qualityFixture();
    const rule = quality.registerRule({
      ruleId: "rule-extra",
      name: "Extra",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.ACCURACY,
    });
    expect(rule.ruleId).toBe("rule-extra");
  });

  it("registerProfile() defaults ruleIds to empty", () => {
    const { quality } = qualityFixture();
    const profile = quality.registerProfile({
      profileId: "profile-extra",
      name: "Extra",
      tenantId: "tenant-1",
    });
    expect(profile.ruleIds).toEqual([]);
  });

  it("registerPolicy() defaults requireApproval/active", () => {
    const { quality } = qualityFixture();
    const policy = quality.registerPolicy({
      policyId: "pol-extra",
      name: "Extra",
      tenantId: "tenant-1",
    });
    expect(policy.requireApproval).toBe(false);
    expect(policy.active).toBe(true);
  });

  it("registerConfiguration() defaults custom to an empty object", () => {
    const { quality } = qualityFixture();
    const configuration = quality.registerConfiguration({
      configurationId: "cfg-extra",
      assessmentId: "g-1",
      tenantId: "tenant-1",
    });
    expect(configuration.custom).toEqual({});
  });

  it("require() throws QualityNotFoundException with a descriptive message", async () => {
    const { quality } = qualityFixture();
    expect(() => quality.require("kqua_missing")).toThrow(/No Assessment is registered/);
    expect(() => quality.require("kqua_missing")).toThrow(QualityNotFoundException);
  });

  it("fail() without a Provider registered still succeeds (start() never required)", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    const record = await quality.fail({ token, reason: "manual failure" });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.FAILED);
  });

  it("cancel() accepts an optional reason", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    const record = await quality.cancel({ token, reason: "user requested" });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.CANCELLED);
  });

  it("start() invokes the configured provider and scoring provider", async () => {
    const { quality } = qualityFixture({
      provider: {
        assess: vi.fn(async () => ({
          findings: [
            {
              dimension: KnowledgeQualityDimension.ACCURACY,
              severity: "medium",
              description: "issue",
            },
          ],
        })),
      },
      scoringProvider: {
        score: vi.fn(async () => [
          { dimension: KnowledgeQualityDimension.ACCURACY, value: 0.8, providerId: "scorer-1" },
        ]),
      },
    });
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    const record = await quality.start({ token });
    expect(record.findings).toHaveLength(1);
    expect(record.scoreMetadata).toHaveLength(1);
    expect(quality.metrics.snapshot().findingCount).toBe(1);
  });

  it("multiple Assessments get independent tokens", async () => {
    const { quality } = qualityFixture();
    const tokenA = await createDraftAssessment(quality);
    const tokenB = await createDraftAssessment(quality);
    expect(tokenA).not.toBe(tokenB);
  });

  it("destroy() drives a Cancelled Assessment to Destroyed", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.cancel({ token });
    const record = await quality.destroy({ token });
    expect(record.state).toBe(KnowledgeQualityAssessmentState.DESTROYED);
    expect(quality.require(token).state).toBe(KnowledgeQualityAssessmentState.DESTROYED);
  });

  it("queue() on an already-Destroyed Assessment throws (Destroyed has no legal outgoing edges to Queued)", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.cancel({ token });
    await quality.destroy({ token });
    await expect(quality.queue({ token })).rejects.toThrow();
  });

  it("createJob() without a scheduledAt omits it", () => {
    const { quality } = qualityFixture();
    const { job } = quality.createJob({ assessmentId: "g-1", tenantId: "tenant-1" });
    expect(job.scheduledAt).toBeUndefined();
  });

  it("createJob() with a scheduledAt records it", () => {
    const { quality } = qualityFixture();
    const scheduledAt = new Date().toISOString();
    const { job } = quality.createJob({ assessmentId: "g-1", tenantId: "tenant-1", scheduledAt });
    expect(job.scheduledAt).toBe(scheduledAt);
  });

  it("failJob() throws QualityNotFoundException for an unknown jobId", () => {
    const { quality } = qualityFixture();
    expect(() => quality.failJob({ jobId: "missing", reason: "x" })).toThrow(
      QualityNotFoundException,
    );
  });

  it("openSession()/closeSession() round trip preserves the holder", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    const opened = quality.openSession({ token, holder: "reviewer-1" });
    const closed = quality.closeSession({ token });
    expect(opened.holder).toBe("reviewer-1");
    expect(closed.holder).toBe("reviewer-1");
  });

  it("get() returns the record for a known token", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    expect(quality.get(token)?.state).toBe(KnowledgeQualityAssessmentState.DRAFT);
  });

  it("count() and list() start at zero on a fresh KnowledgeQuality", () => {
    const { quality } = qualityFixture();
    expect(quality.count()).toBe(0);
    expect(quality.list().assessments).toEqual([]);
  });

  it("health.check() and monitoring.sample() are usable directly off the façade", async () => {
    const { quality } = qualityFixture();
    await createDraftAssessment(quality);
    expect(quality.health.check().status).toBeDefined();
    expect(quality.monitoring.sample().metrics.assessmentCount).toBeGreaterThan(0);
  });

  it("lifecycle.states() exposed on the façade matches the domain state list", () => {
    const { quality } = qualityFixture();
    expect(quality.lifecycle.states()).toHaveLength(10);
  });

  it("hasProvider()/hasScoringProvider() reflect config presence", () => {
    const withoutProviders = qualityFixture().quality;
    expect(withoutProviders.hasProvider()).toBe(false);
    expect(withoutProviders.hasScoringProvider()).toBe(false);

    const withProviders = qualityFixture({
      provider: { assess: vi.fn(async () => ({ findings: [] })) },
      scoringProvider: { score: vi.fn(async () => []) },
    }).quality;
    expect(withProviders.hasProvider()).toBe(true);
    expect(withProviders.hasScoringProvider()).toBe(true);
  });

  it("generateReport() aggregates recorded Finding/ScoreMetadata ids", async () => {
    const { quality } = qualityFixture();
    const token = await createDraftAssessment(quality);
    await quality.queue({ token });
    await quality.prepare({ token });
    await quality.start({ token });
    await quality.recordFinding({
      token,
      dimension: KnowledgeQualityDimension.ACCURACY,
      severity: "medium",
      description: "issue",
    });
    const { report } = await quality.generateReport({ token, summary: "summary" });
    expect(report.findingIds).toHaveLength(1);
    expect(report.summary).toBe("summary");
  });

  it("recordFinding() throws outside Assessing/Reviewing", async () => {
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
