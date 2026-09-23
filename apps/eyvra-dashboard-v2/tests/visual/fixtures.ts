import type { AccountSummaryResponseDto, OverviewResponseDto } from "@/types/dashboard.types";
const accountSummaryFixture: AccountSummaryResponseDto = {
  tenantId: "dss-motor",
  generatedAt: new Date().toISOString(),
  campaignsAnalyzed: 1,
  campaignsCapped: false,
  campaigns: [
    {
      campaignId: "meta-c1",
      campaignName: "Campaign Fix Me",
      spend: 1_500_000,
      health: {
        delivery: {
          status: "WATCH",
          score: 60,
          confidence: 0.6,
          issues: ["Data sufficiency masih LOW."],
        },
        costEfficiency: { status: "HEALTHY", score: 90, confidence: 0.9, issues: [] },
        creative: {
          status: "CRITICAL",
          score: 20,
          confidence: 0.73,
          issues: ["CTR turun 50% dibanding baseline."],
        },
        audience: {
          status: "UNKNOWN",
          confidence: 0,
          issues: ["Data audience-saturation belum tersedia."],
        },
        conversion: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
        tracking: {
          status: "UNKNOWN",
          confidence: 0,
          issues: ["Data tracking/pixel-health belum tersedia."],
        },
        leadQuality: { status: "UNKNOWN", confidence: 0, issues: ["Data CPQL belum tersedia."] },
        overallStatus: "CRITICAL",
      },
      diagnosis: {
        rootCause: "CREATIVE_FATIGUE",
        confidence: 0.73,
        impact: "HIGH",
        evidence: [
          {
            type: "CREATIVE_FATIGUE",
            severity: "HIGH",
            metric: "ctr",
            currentValue: 0.0091,
            baselineValue: 0.0182,
            deltaPct: -0.5,
            confidence: 0.73,
            reasoning: "CTR turun 50% dibanding baseline.",
          },
        ],
        contributingFactors: [],
        recommendedFocus: ["creative"],
      },
      decision: {
        decision: "REQUEST_KAI_CREATIVE",
        primaryDiagnosis: "CREATIVE_FATIGUE",
        confidence: 0.73,
        impact: "HIGH",
        reason:
          "Root cause CREATIVE_FATIGUE terdeteksi (confidence 73%) — creative existing kemungkinan sudah jenuh.",
        riskOfDoingNothing: "CTR dan performa creative berpotensi terus menurun.",
        expectedOutcome: "Creative baru dari Kai berpotensi memulihkan CTR.",
        monitoringPlan: {
          reviewAfterHours: 48,
          successConditions: [
            "Dimensi creative kembali ke status HEALTHY setelah creative baru dari Kai tayang.",
          ],
          rollbackConditions: [
            "Creative baru dari Kai tidak memperbaiki dimensi creative dalam periode review.",
          ],
        },
      },
    },
  ],
  opportunities: [
    {
      type: "CREATIVE_WINNER_EXPANSION",
      confidence: 0.9,
      description:
        'Angle "family-friendly" adalah performer terbaik saat ini (rank 1) — pertimbangkan meminta lebih banyak variasi creative dengan angle ini ke Kai.',
      evidence:
        'Angle "family-friendly" memiliki CPL Rp50000 dari 3 creative package dengan data sufficiency HIGH.',
    },
  ],
  errors: {},
};

const baseOverview: OverviewResponseDto = {
  tenantId: "dss-motor",
  generatedAt: new Date().toISOString(),
  leads: { hot: 12, warm: 5, cold: 3, hotToday: 2, hotYesterday: 1, hotDeltaVsYesterday: 1 },
  campaigns: {
    adAccountId: "act_1",
    datePreset: "last_30d",
    activeCampaignsCount: 2,
    totalCampaignsCount: 2,
    totalSpend: 2_500_000,
    campaigns: [
      {
        id: "c1",
        metaId: "meta-c1",
        stableId: "s1",
        name: "Campaign Fix Me",
        objective: "OUTCOME_LEADS",
        status: "ACTIVE",
        spend: 1_500_000,
        dailyBudget: 100_000,
        adSets: [
          {
            id: "as1",
            metaId: "am1",
            stableId: "as-s1",
            name: "AdSet 1",
            status: "ACTIVE",
            spend: 1_500_000,
            dailyBudget: 100_000,
            ads: [
              {
                id: "ad1",
                metaId: "adm1",
                stableId: "ad-s1",
                name: "Ad 1",
                status: "ACTIVE",
                verdict: "FIX",
                metrics: { spend: 1_500_000, clicks: 40, frequency: 2, totalLead: 3 },
              },
            ],
          },
        ],
      },
    ],
  },
  agentStatus: [
    {
      agent: "SAMANTHA",
      todayAverageOverall: 8.2,
      todaySampleSize: 5,
      priorSevenDaySampleSize: 20,
      actionsToday: 4,
    },
    { agent: "KAI", todaySampleSize: 0, priorSevenDaySampleSize: 0, actionsToday: 0 },
    { agent: "CLARA", todaySampleSize: 0, priorSevenDaySampleSize: 0, actionsToday: 1 },
  ],
  activities: [],
  insight: { available: false, reason: "NO_API_KEY", message: "LLM unavailable" },
  errors: {},
};

export { accountSummaryFixture, baseOverview };
