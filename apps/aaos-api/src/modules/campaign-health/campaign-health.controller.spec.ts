import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { CampaignHealthController } from "./campaign-health.controller.js";
import type { CampaignHealthService } from "./campaign-health.service.js";
import type { CampaignHealth } from "./domain/campaign-health.js";
import type { SamanthaDecision } from "./domain/decision.js";
import type { CampaignDiagnosis } from "./domain/diagnosis.js";
import type { CampaignHealthResponseDto } from "./dto/campaign-health-response.dto.js";

const TENANT = "propertyklik-demo";

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

const RESPONSE_SAMPLE: CampaignHealthResponseDto = {
  campaignId: "meta-cmp-1",
  health: HEALTH_SAMPLE,
  diagnosis: DIAGNOSIS_SAMPLE,
  decision: DECISION_SAMPLE,
};

function buildFakeService(): CampaignHealthService {
  return {
    assess: vi.fn(async () => RESPONSE_SAMPLE),
  } as unknown as CampaignHealthService;
}

describe("CampaignHealthController", () => {
  it("assess() delegates to the service with tenant id and campaignId", async () => {
    const service = buildFakeService();
    const controller = new CampaignHealthController(service);
    const result = await controller.assess(TENANT, "meta-cmp-1");
    expect(service.assess).toHaveBeenCalledWith(TENANT, "meta-cmp-1");
    expect(result.campaignId).toBe("meta-cmp-1");
    expect(result.health.overallStatus).toBe("HEALTHY");
    expect(result.decision.decision).toBe("NO_ACTION");
  });
});
