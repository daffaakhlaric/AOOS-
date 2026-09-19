import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";
import type { CampaignHealth } from "../domain/campaign-health.js";
import type { SamanthaDecision } from "../domain/decision.js";
import type { CampaignDiagnosis } from "../domain/diagnosis.js";

import {
  CampaignAssessmentRepository,
  CampaignAssessmentRepositoryError,
} from "./campaign-assessment.repository.js";

const TENANT = "propertyklik-demo";
const META_CAMPAIGN_ID = "meta-cmp-1";

function healthyDimension(): CampaignHealth["delivery"] {
  return { status: "HEALTHY", score: 100, confidence: 1, issues: [] };
}

const HEALTH_SAMPLE: CampaignHealth = {
  delivery: healthyDimension(),
  costEfficiency: healthyDimension(),
  creative: healthyDimension(),
  audience: { status: "UNKNOWN", confidence: 0, issues: ["no data"] },
  conversion: healthyDimension(),
  tracking: { status: "UNKNOWN", confidence: 0, issues: ["no data"] },
  leadQuality: { status: "UNKNOWN", confidence: 0, issues: ["no data"] },
  overallStatus: "HEALTHY",
};

const DIAGNOSIS_SAMPLE: CampaignDiagnosis = {
  confidence: 0,
  impact: "UNKNOWN",
  evidence: [],
  contributingFactors: [],
  recommendedFocus: [],
};

const DECISION_SAMPLE: SamanthaDecision = {
  decision: "NO_ACTION",
  confidence: 1,
  impact: "LOW",
  reason: "Semua dimensi campaign health yang punya data nyata berstatus HEALTHY.",
  riskOfDoingNothing: "Tidak ada risiko signifikan.",
  expectedOutcome: "Performa campaign berpotensi tetap stabil selama tidak ada perubahan berarti.",
  monitoringPlan: {
    reviewAfterHours: 72,
    successConditions: ["overallStatus tetap HEALTHY pada penilaian berikutnya."],
    rollbackConditions: [],
  },
};

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "assess-1",
    tenant_id: TENANT,
    meta_campaign_id: META_CAMPAIGN_ID,
    health: HEALTH_SAMPLE,
    diagnosis: DIAGNOSIS_SAMPLE,
    decision: DECISION_SAMPLE,
    assessed_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CampaignAssessmentRepository", () => {
  it("record() inserts a real row for the tenant/campaign", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CampaignAssessmentRepository(client);
    await repo.record(TENANT, META_CAMPAIGN_ID, HEALTH_SAMPLE, DIAGNOSIS_SAMPLE, DECISION_SAMPLE);

    const rows = client.rows("samantha_campaign_assessments");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenant_id).toBe(TENANT);
    expect(rows[0]?.meta_campaign_id).toBe(META_CAMPAIGN_ID);
    expect(rows[0]?.health).toEqual(HEALTH_SAMPLE);
    expect(rows[0]?.diagnosis).toEqual(DIAGNOSIS_SAMPLE);
    expect(rows[0]?.decision).toEqual(DECISION_SAMPLE);
  });

  it("record() throws CampaignAssessmentRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("samantha_campaign_assessments", "boom");
    const repo = new CampaignAssessmentRepository(client);
    await expect(
      repo.record(TENANT, META_CAMPAIGN_ID, HEALTH_SAMPLE, DIAGNOSIS_SAMPLE, DECISION_SAMPLE),
    ).rejects.toThrow(CampaignAssessmentRepositoryError);
  });

  it("listHistory() returns rows newest-first, mapped to camelCase", async () => {
    const client = createFakeSupabaseClient();
    client.seed(
      "samantha_campaign_assessments",
      seedRow({ id: "assess-1", assessed_at: "2026-01-01T00:00:00.000Z" }),
    );
    client.seed(
      "samantha_campaign_assessments",
      seedRow({ id: "assess-2", assessed_at: "2026-01-02T00:00:00.000Z" }),
    );
    const repo = new CampaignAssessmentRepository(client);
    const history = await repo.listHistory(TENANT, META_CAMPAIGN_ID, 20);

    expect(history).toHaveLength(2);
    expect(history[0]?.id).toBe("assess-2");
    expect(history[1]?.id).toBe("assess-1");
    expect(history[0]?.health).toEqual(HEALTH_SAMPLE);
    expect(history[0]?.assessedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("listHistory() is tenant-scoped — a matching campaign under a different tenant is not returned", async () => {
    const client = createFakeSupabaseClient();
    client.seed("samantha_campaign_assessments", seedRow({ tenant_id: "other-tenant" }));
    const repo = new CampaignAssessmentRepository(client);
    expect(await repo.listHistory(TENANT, META_CAMPAIGN_ID, 20)).toHaveLength(0);
  });

  it("listHistory() is capped at the given limit", async () => {
    const client = createFakeSupabaseClient();
    for (let i = 0; i < 5; i += 1) {
      client.seed("samantha_campaign_assessments", seedRow({ id: `assess-${i}` }));
    }
    const repo = new CampaignAssessmentRepository(client);
    const history = await repo.listHistory(TENANT, META_CAMPAIGN_ID, 3);
    expect(history).toHaveLength(3);
  });

  it("listHistory() throws CampaignAssessmentRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("samantha_campaign_assessments", "boom");
    const repo = new CampaignAssessmentRepository(client);
    await expect(repo.listHistory(TENANT, META_CAMPAIGN_ID, 20)).rejects.toThrow(
      CampaignAssessmentRepositoryError,
    );
  });

  describe("listLatestPerCampaign", () => {
    it("returns the LATEST real row per meta_campaign_id, keyed by campaign id", async () => {
      const client = createFakeSupabaseClient();
      client.seed(
        "samantha_campaign_assessments",
        seedRow({
          id: "a1-old",
          meta_campaign_id: "campaign-a",
          assessed_at: "2026-01-01T00:00:00.000Z",
        }),
      );
      client.seed(
        "samantha_campaign_assessments",
        seedRow({
          id: "a1-new",
          meta_campaign_id: "campaign-a",
          assessed_at: "2026-01-03T00:00:00.000Z",
        }),
      );
      client.seed(
        "samantha_campaign_assessments",
        seedRow({
          id: "b1",
          meta_campaign_id: "campaign-b",
          assessed_at: "2026-01-02T00:00:00.000Z",
        }),
      );
      const repo = new CampaignAssessmentRepository(client);
      const latest = await repo.listLatestPerCampaign(TENANT);

      expect(latest.size).toBe(2);
      expect(latest.get("campaign-a")?.id).toBe("a1-new");
      expect(latest.get("campaign-b")?.id).toBe("b1");
    });

    it("is tenant-scoped — a different tenant's rows never leak into the result", async () => {
      const client = createFakeSupabaseClient();
      client.seed(
        "samantha_campaign_assessments",
        seedRow({ id: "other", tenant_id: "other-tenant", meta_campaign_id: "campaign-a" }),
      );
      const repo = new CampaignAssessmentRepository(client);
      const latest = await repo.listLatestPerCampaign(TENANT);
      expect(latest.size).toBe(0);
    });

    it("returns an honest empty map when the tenant has never recorded any real assessment", async () => {
      const client = createFakeSupabaseClient();
      const repo = new CampaignAssessmentRepository(client);
      const latest = await repo.listLatestPerCampaign(TENANT);
      expect(latest.size).toBe(0);
    });

    it("throws CampaignAssessmentRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("samantha_campaign_assessments", "boom");
      const repo = new CampaignAssessmentRepository(client);
      await expect(repo.listLatestPerCampaign(TENANT)).rejects.toThrow(
        CampaignAssessmentRepositoryError,
      );
    });
  });
});
