import { err, ok, type Result } from "@aos/common";
import { formatIDR } from "@aos/meta-ads-connector";
import type { ObjectiveProgress } from "@aos/objective-engine";

import type { AgentMemory } from "../domain/entities/AgentMemory.js";
import type { CreativeBrief } from "../domain/entities/CreativeBrief.js";
import { DailyDigest } from "../domain/entities/DailyDigest.js";
import type { EscalationRequest } from "../domain/entities/EscalationRequest.js";
import type { ExecutionPlan } from "../domain/entities/ExecutionPlan.js";
import { DecisionError } from "../domain/errors/index.js";
import { AudienceInsightEngine } from "../intelligence/AudienceInsightEngine.js";
import type { PerAdFinding } from "../types/AgentTypes.js";
import { IndonesianTextGenerator } from "../utils/IndonesianTextGenerator.js";
import { PerformanceRanker } from "../utils/PerformanceRanker.js";

export interface DailyDigestBuildInput {
  readonly tenantId: string;
  readonly date: Date;
  readonly targetHotLeads: number;
  readonly budgetAllocationIDR: number;
  readonly progress: ObjectiveProgress;
  readonly plan: ExecutionPlan;
  readonly creativeBriefs: ReadonlyArray<CreativeBrief>;
  readonly escalations: ReadonlyArray<EscalationRequest>;
  readonly adFindings: ReadonlyArray<PerAdFinding>;
  /** AAOS-W1D-S1S2 (S2) — when supplied, the digest text gains a "Status Stok" + "Promo Aktif" section built from real inventory/promo data (see `IndonesianTextGenerator.inventorySection`). */
  readonly memory?: AgentMemory;
}

const TOP_PERFORMER_COUNT = 3;

/** Builds a `DailyDigest` — every number below is read directly off the actual `ObjectiveProgress`/`ExecutionPlan`/briefs/escalations passed in for this cycle, never hardcoded. */
export class DailyDigestBuilder {
  static build(input: DailyDigestBuildInput): Result<DailyDigest, DecisionError> {
    const currentHotLeads = input.progress.currentHotLeads;
    const progressPercentage = Math.round(input.progress.progressPercentage.toNumber());
    const forecastedHotLeads = input.progress.forecastedHotLeads.toNumber();
    // `OnTrackStatus` is exported as a type-only re-export from `@aos/objective-engine`'s public
    // API (no runtime enum value available), so its `"ON_TRACK"` member is compared by string
    // literal rather than imported.
    const onTrack = input.progress.onTrackStatus === "ON_TRACK";

    const budgetSpentIDR = input.progress.currentSpend.toNumber();
    const budgetSpentPercentage =
      input.budgetAllocationIDR > 0
        ? Math.round((budgetSpentIDR / input.budgetAllocationIDR) * 100)
        : 0;
    const burnRateIDR = Math.round(input.progress.budgetBurnRate);
    const budgetRemainingIDR = Math.max(0, input.budgetAllocationIDR - budgetSpentIDR);
    const daysOfBudgetRemaining =
      burnRateIDR > 0 ? Math.floor(budgetRemainingIDR / burnRateIDR) : input.progress.daysRemaining;

    const autoExecutedSummaryLines = DailyDigestBuilder.autoExecutedLines(input.plan);
    const creativeBriefSummaryLines = input.creativeBriefs.map(
      (brief) =>
        `#${brief.adId} (${brief.branch} ${brief.unit}) — ${brief.reason}. Angle: ${brief.angle}`,
    );
    const pendingEscalationSummaryLines = input.escalations
      .filter((escalation) => escalation.isPending())
      .map(
        (escalation) =>
          `${escalation.decision.impact.description} — ${escalation.decision.reason.toString()}`,
      );

    const topPerformers = PerformanceRanker.topPerformers(input.adFindings, TOP_PERFORMER_COUNT);
    const weeklyRecommendation = DailyDigestBuilder.weeklyRecommendation(input.adFindings);

    const text = IndonesianTextGenerator.generateDigest({
      date: input.date,
      targetHotLeads: input.targetHotLeads,
      currentHotLeads,
      progressPercentage,
      forecastedHotLeads,
      onTrack,
      budgetAllocatedIDR: input.budgetAllocationIDR,
      budgetSpentIDR,
      budgetSpentPercentage,
      burnRateIDR,
      budgetRemainingIDR,
      daysOfBudgetRemaining,
      autoExecutedSummaryLines,
      creativeBriefSummaryLines,
      pendingEscalationSummaryLines,
      topPerformers,
      weeklyRecommendation,
      memory: input.memory,
    });

    const digestResult = DailyDigest.create({
      tenantId: input.tenantId,
      date: input.date,
      targetHotLeads: input.targetHotLeads,
      currentHotLeads,
      progressPercentage,
      forecastedHotLeads,
      onTrack,
      budgetAllocatedIDR: input.budgetAllocationIDR,
      budgetSpentIDR,
      budgetSpentPercentage,
      burnRateIDR,
      budgetRemainingIDR,
      daysOfBudgetRemaining,
      autoExecutedSummaryLines,
      creativeBriefSummaryLines,
      pendingEscalationSummaryLines,
      topPerformers,
      weeklyRecommendation,
      text,
    });
    if (!digestResult.ok) {
      return err(new DecisionError(digestResult.error.message));
    }
    return ok(digestResult.value);
  }

  private static autoExecutedLines(plan: ExecutionPlan): ReadonlyArray<string> {
    const executed = plan.autoExecuted();
    const lines: string[] = [];

    const pauses = executed.filter((d) => d.actionKind === "PAUSE");
    if (pauses.length > 0) {
      const savedIDR = pauses.reduce((sum, d) => sum + (d.spendIDR ?? 0), 0);
      lines.push(`Pause ${pauses.length} iklan boros (hemat ${formatIDR(savedIDR)})`);
    }

    const scales = executed.filter((d) => d.actionKind === "SCALE");
    for (const scale of scales) {
      lines.push(`Naikkan budget ${scale.targetId} (${formatIDR(scale.budgetChangeIDR ?? 0)})`);
    }

    const fixes = executed.filter((d) => d.actionKind === "FIX");
    for (const fix of fixes) {
      lines.push(`Fix objective ${fix.targetId}`);
    }

    const reallocations = executed.filter((d) => d.actionKind === "REALLOCATE_BUDGET");
    for (const reallocation of reallocations) {
      lines.push(
        `${reallocation.impact.description} (${formatIDR(reallocation.budgetChangeIDR ?? 0)})`,
      );
    }

    return lines;
  }

  private static weeklyRecommendation(findings: ReadonlyArray<PerAdFinding>): string {
    const insights = AudienceInsightEngine.byBranch(findings);
    const best = AudienceInsightEngine.bestRespondingBranch(insights);
    const worst = AudienceInsightEngine.worstRespondingBranch(insights);
    if (!best || !worst || best.branch === worst.branch) {
      return "Pantau terus performa harian, belum ada rekomendasi realokasi minggu ini.";
    }
    return `Fokuskan budget ke ${best.branch}. ${worst.branch} perlu creative baru atau pause sementara.`;
  }
}
