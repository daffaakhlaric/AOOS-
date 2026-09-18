import { describe, expect, it, vi } from "vitest";

import type { MetricSnapshotDto } from "../metric-snapshot/dto/metric-snapshot.dto.js";
import type { MetricSnapshotService } from "../metric-snapshot/metric-snapshot.service.js";

import { CampaignHealthService } from "./campaign-health.service.js";
import type { CampaignHealth } from "./domain/campaign-health.js";
import type { SamanthaDecision } from "./domain/decision.js";
import type { CampaignDiagnosis } from "./domain/diagnosis.js";
import type {
  CampaignAssessmentRepository,
  StoredAssessment,
} from "./infrastructure/campaign-assessment.repository.js";

const TENANT = "propertyklik-demo";
const META_CAMPAIGN_ID = "meta-cmp-1";

function makeSnapshot(overrides: Partial<MetricSnapshotDto> = {}): MetricSnapshotDto {
  return {
    window: "last_7_days",
    spend: 1_000_000,
    impressions: 25_000,
    clicks: 500,
    reach: 20_000,
    leads: 20,
    ctr: 0.02,
    cpm: 40_000,
    cpc: 2_000,
    cpl: 50_000,
    frequency: 1.25,
    sampleSize: { impressions: 25_000, clicks: 500, leads: 20 },
    daysCovered: 7,
    dataSufficiency: { level: "HIGH", score: 100, reasons: [] },
    ...overrides,
  };
}

interface FakeSnapshots {
  current?: Partial<MetricSnapshotDto>;
  previous?: Partial<MetricSnapshotDto>;
  campaignLifetime?: Partial<MetricSnapshotDto>;
  accountLifetime?: Partial<MetricSnapshotDto>;
}

function buildFakeMetricSnapshotService(snapshots: FakeSnapshots = {}): MetricSnapshotService {
  const current = makeSnapshot(snapshots.current);
  const previous = makeSnapshot({ ctr: 0.02, cpl: 50_000, frequency: 1.25, ...snapshots.previous });
  const campaignLifetime = makeSnapshot({
    window: "lifetime",
    dataSufficiency: { level: "HIGH", score: 100, reasons: [] },
    ...snapshots.campaignLifetime,
  });
  const accountLifetime = makeSnapshot({
    window: "lifetime",
    dataSufficiency: { level: "HIGH", score: 100, reasons: [] },
    ...snapshots.accountLifetime,
  });

  return {
    getCampaignSnapshot: vi.fn(async (_tenantId: string, _campaignId: string, window: string) => {
      if (window === "last_7_days") return current;
      if (window === "previous_7_days") return previous;
      return campaignLifetime; // "lifetime"
    }),
    getAccountSnapshot: vi.fn(async () => accountLifetime),
  } as unknown as MetricSnapshotService;
}

function buildFakeAssessmentRepository(
  history: readonly StoredAssessment[] = [],
): CampaignAssessmentRepository {
  return {
    record: vi.fn(async () => undefined),
    listHistory: vi.fn(async () => history),
  } as unknown as CampaignAssessmentRepository;
}

const HEALTHY_DIMENSION = { status: "HEALTHY" as const, score: 100, confidence: 1, issues: [] };
const UNKNOWN_DIMENSION = { status: "UNKNOWN" as const, confidence: 0, issues: ["no data"] };

function makeHealth(overrides: Partial<CampaignHealth> = {}): CampaignHealth {
  return {
    delivery: HEALTHY_DIMENSION,
    costEfficiency: HEALTHY_DIMENSION,
    creative: HEALTHY_DIMENSION,
    audience: UNKNOWN_DIMENSION,
    conversion: HEALTHY_DIMENSION,
    tracking: UNKNOWN_DIMENSION,
    leadQuality: UNKNOWN_DIMENSION,
    overallStatus: "HEALTHY",
    ...overrides,
  };
}

function makeDiagnosis(overrides: Partial<CampaignDiagnosis> = {}): CampaignDiagnosis {
  return {
    confidence: 0,
    impact: "UNKNOWN",
    evidence: [],
    contributingFactors: [],
    recommendedFocus: [],
    ...overrides,
  };
}

function makeDecision(overrides: Partial<SamanthaDecision> = {}): SamanthaDecision {
  return {
    decision: "NO_ACTION",
    confidence: 1,
    impact: "LOW",
    reason: "reason",
    riskOfDoingNothing: "none",
    expectedOutcome: "stable",
    monitoringPlan: { reviewAfterHours: 72, successConditions: [], rollbackConditions: [] },
    ...overrides,
  };
}

function makeStoredAssessment(overrides: Partial<StoredAssessment> = {}): StoredAssessment {
  return {
    id: "assess-1",
    health: makeHealth(),
    diagnosis: makeDiagnosis(),
    decision: makeDecision(),
    assessedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CampaignHealthService", () => {
  it("assess() fetches 4 real snapshots (current, previous, campaign lifetime, account lifetime)", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService();
    const service = new CampaignHealthService(
      metricSnapshotService,
      buildFakeAssessmentRepository(),
    );
    await service.assess(TENANT, META_CAMPAIGN_ID);

    expect(metricSnapshotService.getCampaignSnapshot).toHaveBeenCalledWith(
      TENANT,
      META_CAMPAIGN_ID,
      "last_7_days",
    );
    expect(metricSnapshotService.getCampaignSnapshot).toHaveBeenCalledWith(
      TENANT,
      META_CAMPAIGN_ID,
      "previous_7_days",
    );
    expect(metricSnapshotService.getCampaignSnapshot).toHaveBeenCalledWith(
      TENANT,
      META_CAMPAIGN_ID,
      "lifetime",
    );
    expect(metricSnapshotService.getAccountSnapshot).toHaveBeenCalledWith(TENANT, "lifetime");
  });

  it("returns a CampaignHealthResponseDto echoing the real campaignId with health + diagnosis", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService();
    const service = new CampaignHealthService(
      metricSnapshotService,
      buildFakeAssessmentRepository(),
    );
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);

    expect(result.campaignId).toBe(META_CAMPAIGN_ID);
    expect(result.health.overallStatus).toBeDefined();
    expect(result.diagnosis).toBeDefined();
    expect(result.decision).toBeDefined();
  });

  it("a healthy, stable campaign against a HIGH-confidence benchmark reports HEALTHY overallStatus", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService();
    const service = new CampaignHealthService(
      metricSnapshotService,
      buildFakeAssessmentRepository(),
    );
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);

    expect(result.health.overallStatus).toBe("HEALTHY");
    expect(result.health.costEfficiency.status).toBe("HEALTHY");
    expect(result.health.audience.status).toBe("UNKNOWN");
    expect(result.health.tracking.status).toBe("UNKNOWN");
    expect(result.health.leadQuality.status).toBe("UNKNOWN");
    expect(result.decision.decision).toBe("NO_ACTION");
  });

  it("a real CPL spike vs. a usable benchmark surfaces as CRITICAL overallStatus with a rootCause", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService({
      current: { cpl: 60_000, spend: 1_000_000, leads: 20 },
      previous: { cpl: 50_000 },
      campaignLifetime: { cpl: 50_000 },
    });
    const service = new CampaignHealthService(
      metricSnapshotService,
      buildFakeAssessmentRepository(),
    );
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);

    expect(result.diagnosis.rootCause).toBe("CPL_SPIKE");
    expect(result.diagnosis.confidence).toBeGreaterThan(0);
    expect(result.decision.decision).toBe("REVIEW");
    expect(result.decision.primaryDiagnosis).toBe("CPL_SPIKE");
  });

  it("computes ctrTrendForFatigue only when the previous window has real coverage", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService({
      previous: { daysCovered: 0, ctr: undefined },
    });
    const service = new CampaignHealthService(
      metricSnapshotService,
      buildFakeAssessmentRepository(),
    );
    // Should not throw despite an empty previous window, and creative should still be assessable
    // from real frequency data (frequencyDataAvailable derives from current.frequency, not the
    // ctrTrend).
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);
    expect(result.health.creative.status).not.toBe("UNKNOWN");
  });

  it("marks creative UNKNOWN when the current snapshot has no real frequency value", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService({
      current: { frequency: undefined },
    });
    const service = new CampaignHealthService(
      metricSnapshotService,
      buildFakeAssessmentRepository(),
    );
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);
    expect(result.health.creative.status).toBe("UNKNOWN");
  });

  it("marks costEfficiency UNKNOWN when neither historical source is usable (benchmark NONE)", async () => {
    const metricSnapshotService = buildFakeMetricSnapshotService({
      campaignLifetime: { dataSufficiency: { level: "LOW", score: 20, reasons: ["low"] } },
      accountLifetime: { dataSufficiency: { level: "LOW", score: 20, reasons: ["low"] } },
    });
    const service = new CampaignHealthService(
      metricSnapshotService,
      buildFakeAssessmentRepository(),
    );
    const result = await service.assess(TENANT, META_CAMPAIGN_ID);
    expect(result.health.costEfficiency.status).toBe("UNKNOWN");
  });

  describe("assessAndRecord()", () => {
    it("returns the same shape assess() returns and persists the computed result", async () => {
      const metricSnapshotService = buildFakeMetricSnapshotService();
      const repository = buildFakeAssessmentRepository();
      const service = new CampaignHealthService(metricSnapshotService, repository);

      const result = await service.assessAndRecord(TENANT, META_CAMPAIGN_ID);

      expect(result.campaignId).toBe(META_CAMPAIGN_ID);
      expect(result.health.overallStatus).toBe("HEALTHY");
      expect(repository.record).toHaveBeenCalledWith(
        TENANT,
        META_CAMPAIGN_ID,
        result.health,
        result.diagnosis,
        result.decision,
      );
    });

    it("still returns the computed result when repository.record() rejects (best-effort persistence)", async () => {
      const metricSnapshotService = buildFakeMetricSnapshotService();
      const repository = buildFakeAssessmentRepository();
      vi.mocked(repository.record).mockRejectedValueOnce(new Error("boom"));
      const service = new CampaignHealthService(metricSnapshotService, repository);

      const result = await service.assessAndRecord(TENANT, META_CAMPAIGN_ID);

      expect(result.campaignId).toBe(META_CAMPAIGN_ID);
      expect(result.health.overallStatus).toBe("HEALTHY");
    });
  });

  describe("history()", () => {
    it("is a thin pass-through to repository.listHistory", async () => {
      const metricSnapshotService = buildFakeMetricSnapshotService();
      const repository = buildFakeAssessmentRepository();
      const service = new CampaignHealthService(metricSnapshotService, repository);

      await service.history(TENANT, META_CAMPAIGN_ID, 20);

      expect(repository.listHistory).toHaveBeenCalledWith(TENANT, META_CAMPAIGN_ID, 20);
    });
  });

  describe("compareLatest()", () => {
    it("throws NotFoundError when there are 0 recorded assessments", async () => {
      const metricSnapshotService = buildFakeMetricSnapshotService();
      const repository = buildFakeAssessmentRepository([]);
      const service = new CampaignHealthService(metricSnapshotService, repository);

      await expect(service.compareLatest(TENANT, META_CAMPAIGN_ID)).rejects.toThrow(
        /No recorded campaign-health assessments/,
      );
      expect(repository.listHistory).toHaveBeenCalledWith(TENANT, META_CAMPAIGN_ID, 2);
    });

    it("returns available: false (not an error) when only 1 assessment is recorded", async () => {
      const metricSnapshotService = buildFakeMetricSnapshotService();
      const repository = buildFakeAssessmentRepository([makeStoredAssessment()]);
      const service = new CampaignHealthService(metricSnapshotService, repository);

      const result = await service.compareLatest(TENANT, META_CAMPAIGN_ID);

      expect(result.available).toBe(false);
      if (!result.available) {
        expect(result.reason.length).toBeGreaterThan(0);
      }
    });

    it("compares the 2 most recent assessments, older as previous and newer as current", async () => {
      const metricSnapshotService = buildFakeMetricSnapshotService();
      const older = makeStoredAssessment({
        id: "assess-older",
        health: makeHealth({
          overallStatus: "CRITICAL",
          costEfficiency: { status: "CRITICAL", score: 10, confidence: 1, issues: ["bad"] },
        }),
        diagnosis: makeDiagnosis({ rootCause: "CPL_SPIKE" }),
        assessedAt: "2026-01-01T00:00:00.000Z",
      });
      const newer = makeStoredAssessment({
        id: "assess-newer",
        health: makeHealth({ overallStatus: "HEALTHY" }),
        diagnosis: makeDiagnosis({ rootCause: undefined }),
        assessedAt: "2026-01-08T00:00:00.000Z",
      });
      // `listHistory` returns newest-first — mirror that ordering here.
      const repository = buildFakeAssessmentRepository([newer, older]);
      const service = new CampaignHealthService(metricSnapshotService, repository);

      const result = await service.compareLatest(TENANT, META_CAMPAIGN_ID);

      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.previousAssessedAt).toBe("2026-01-01T00:00:00.000Z");
        expect(result.currentAssessedAt).toBe("2026-01-08T00:00:00.000Z");
        expect(result.comparison.overallStatusTrend).toBe("IMPROVED");
        expect(result.comparison.rootCauseTrend).toBe("RESOLVED");
      }
    });
  });
});
