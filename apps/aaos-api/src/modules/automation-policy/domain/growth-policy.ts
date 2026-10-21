import { z } from "zod";

import { AUTOMATION_MODES } from "../../growth-objectives/dto/growth-objective.dto.js";

const money = z.number().finite().nonnegative().max(1e12);
const rate = z.number().min(0).max(1);
const hours = z.number().int().min(1).max(8760);
export const GROWTH_ACTIONS = [
  "SCALE",
  "REDUCE_BUDGET",
  "PAUSE_CREATIVE",
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "REQUEST_KAI_REFRESH",
  "PUBLISH_CREATIVE",
  "CREATE_EXPERIMENT",
  "CREATE_CAMPAIGN_DRAFT",
  "ACTIVATE_CAMPAIGN",
  "UPDATE_AUDIENCE",
  "FIX_TRACKING",
] as const;
const permissions = z
  .object(
    Object.fromEntries(
      GROWTH_ACTIONS.map((action) => [action, z.enum(["AUTO", "APPROVAL_REQUIRED", "DISABLED"])]),
    ) as Record<
      (typeof GROWTH_ACTIONS)[number],
      z.ZodEnum<["AUTO", "APPROVAL_REQUIRED", "DISABLED"]>
    >,
  )
  .strict();

/** Server-owned pace profiles. Hard caps always take precedence. */
export const PACE_PROFILES = {
  CONSERVATIVE: { scalePercent: 5, cooldownHours: 96, reviewHours: 72 },
  MODERATE: { scalePercent: 10, cooldownHours: 72, reviewHours: 48 },
  AGGRESSIVE: { scalePercent: 15, cooldownHours: 48, reviewHours: 24 },
  MAX_GROWTH: { scalePercent: 20, cooldownHours: 24, reviewHours: 24 },
} as const;

export const GrowthPolicySchema = z
  .object({
    growthObjective: z.enum([
      "QUALIFIED_LEADS",
      "LEAD_VOLUME",
      "SALES_CONVERSION",
      "REVENUE",
      "ROAS",
      "BRAND_AWARENESS",
    ]),
    targetWindowDays: z.number().int().min(1).max(365),
    targets: z
      .object({
        monthlyLeads: z.number().int().nonnegative().nullable(),
        costPerOutcome: money.nullable(),
        roas: z.number().positive().nullable(),
        monthlySales: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    pace: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE", "MAX_GROWTH"]),
    autonomousMode: z.enum(AUTOMATION_MODES),
    optimizationBasis: z.enum(["BUSINESS_OUTCOME", "META_LEAD"]).default("BUSINESS_OUTCOME"),
    budgetPolicy: z
      .object({
        autoScaleEnabled: z.boolean(),
        autoReduceEnabled: z.boolean(),
        reallocation: z.enum(["OFF", "RECOMMEND_ONLY", "GUARDED_AUTOMATIC"]),
        maxScalePercentPerAction: z.number().min(0).max(100),
        maxReductionPercentPerAction: z.number().min(0).max(100),
        dailyBudgetFloor: money,
        dailyBudgetCeiling: money.nullable(),
        accountDailySpendCap: money.nullable(),
        monthlySpendCap: money.nullable(),
        minimumObservationHours: hours,
        scaleCooldownHours: hours,
        reductionCooldownHours: hours,
        minimumLeads: z.number().int().nonnegative(),
        maximumCostPerOutcome: money.nullable(),
      })
      .strict(),
    creativePolicy: z
      .object({
        autoCreativeRefresh: z.boolean(),
        autoWinnerExpansion: z.boolean(),
        autoGenerateVariants: z.boolean(),
        qaRequired: z.literal(true),
        simulationRequired: z.literal(true),
        minimumActiveCreatives: z.number().int().min(1).max(100),
        targetCreativeCapacity: z.number().int().min(1).max(100),
        maxCreativeChangesPerWindow: z.number().int().min(1).max(100),
        refreshCooldownHours: hours,
        allowImage: z.boolean(),
        allowVideo: z.boolean(),
        allowCarousel: z.boolean(),
        explorationRate: rate,
        quality: z.enum(["PERFORMANCE", "BALANCED", "PREMIUM", "SOCIAL_NATIVE"]),
        preferredDurationSeconds: z.number().int().min(5).max(60),
        allowVoiceover: z.boolean(),
        allowAiScenes: z.boolean(),
      })
      .strict(),
    audiencePolicy: z
      .object({
        mode: z.enum(["OFF", "RECOMMEND", "EXPERIMENT_FIRST", "GUARDED_AUTOMATIC"]),
        allowGeoExpansion: z.boolean(),
        allowAudienceBroadening: z.boolean(),
        allowRetargeting: z.boolean(),
        allowLookalikeExperiment: z.boolean(),
        maximumGeoExpansionKm: z.number().min(0).max(500),
        cooldownHours: hours,
        minimumQuality: rate,
      })
      .strict(),
    conversionPolicy: z
      .object({
        primaryMetric: z.enum([
          "LEAD",
          "QUALIFIED_LEAD",
          "HOT_LEAD",
          "APPOINTMENT",
          "BOOKING",
          "PURCHASE",
          "REVENUE",
          "ROAS",
        ]),
        minimumQualifiedRate: rate,
        minimumHotLeadRate: rate,
        maximumCrmAgeHours: hours,
        flagSalesIssues: z.boolean(),
        useFirstMessageIntelligence: z.boolean(),
      })
      .strict(),
    safetyPolicy: z
      .object({
        killSwitch: z.boolean(),
        minimumConfidence: rate,
        neverPauseFinalCreative: z.literal(true),
        newCampaignsStartPaused: z.literal(true),
        claimVerificationRequired: z.literal(true),
        maxAutoPublishedPerDay: z.number().int().min(0).max(100),
        permissions,
        useHistoricalLearning: z.boolean(),
        useExperimentLearning: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.budgetPolicy.dailyBudgetCeiling !== null &&
      p.budgetPolicy.dailyBudgetFloor > p.budgetPolicy.dailyBudgetCeiling
    )
      ctx.addIssue({
        code: "custom",
        path: ["budgetPolicy", "dailyBudgetFloor"],
        message: "Budget minimum melebihi maksimum.",
      });
    if (p.creativePolicy.minimumActiveCreatives > p.creativePolicy.targetCreativeCapacity)
      ctx.addIssue({
        code: "custom",
        path: ["creativePolicy", "targetCreativeCapacity"],
        message: "Kapasitas target di bawah jumlah creative minimum.",
      });
    if (
      !p.creativePolicy.allowImage &&
      !p.creativePolicy.allowVideo &&
      !p.creativePolicy.allowCarousel
    )
      ctx.addIssue({
        code: "custom",
        path: ["creativePolicy"],
        message: "Pilih minimal satu format creative.",
      });
  });
export type GrowthPolicy = z.infer<typeof GrowthPolicySchema>;
export function defaultGrowthPolicy(): GrowthPolicy {
  return GrowthPolicySchema.parse({
    growthObjective: "QUALIFIED_LEADS",
    targetWindowDays: 30,
    targets: { monthlyLeads: null, costPerOutcome: null, roas: null, monthlySales: null },
    pace: "MODERATE",
    autonomousMode: "COPILOT",
    budgetPolicy: {
      autoScaleEnabled: false,
      autoReduceEnabled: false,
      reallocation: "RECOMMEND_ONLY",
      maxScalePercentPerAction: 15,
      maxReductionPercentPerAction: 15,
      dailyBudgetFloor: 0,
      dailyBudgetCeiling: null,
      accountDailySpendCap: null,
      monthlySpendCap: null,
      minimumObservationHours: 72,
      scaleCooldownHours: 72,
      reductionCooldownHours: 48,
      minimumLeads: 20,
      maximumCostPerOutcome: null,
    },
    creativePolicy: {
      autoCreativeRefresh: true,
      autoWinnerExpansion: false,
      autoGenerateVariants: false,
      qaRequired: true,
      simulationRequired: true,
      minimumActiveCreatives: 1,
      targetCreativeCapacity: 5,
      maxCreativeChangesPerWindow: 3,
      refreshCooldownHours: 72,
      allowImage: true,
      allowVideo: true,
      allowCarousel: true,
      explorationRate: 0.3,
      quality: "BALANCED",
      preferredDurationSeconds: 15,
      allowVoiceover: false,
      allowAiScenes: false,
    },
    audiencePolicy: {
      mode: "EXPERIMENT_FIRST",
      allowGeoExpansion: false,
      allowAudienceBroadening: false,
      allowRetargeting: false,
      allowLookalikeExperiment: false,
      maximumGeoExpansionKm: 0,
      cooldownHours: 72,
      minimumQuality: 0.3,
    },
    conversionPolicy: {
      primaryMetric: "QUALIFIED_LEAD",
      minimumQualifiedRate: 0.2,
      minimumHotLeadRate: 0.1,
      maximumCrmAgeHours: 24,
      flagSalesIssues: true,
      useFirstMessageIntelligence: false,
    },
    safetyPolicy: {
      killSwitch: false,
      minimumConfidence: 0.85,
      neverPauseFinalCreative: true,
      newCampaignsStartPaused: true,
      claimVerificationRequired: true,
      maxAutoPublishedPerDay: 3,
      permissions: Object.fromEntries(GROWTH_ACTIONS.map((a) => [a, "APPROVAL_REQUIRED"])),
      useHistoricalLearning: true,
      useExperimentLearning: true,
    },
  });
}
