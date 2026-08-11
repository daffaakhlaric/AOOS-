import { err, ok, type Result } from "@aos/common";
import { formatIDR, Verdict } from "@aos/meta-ads-connector";

import type { MetaAdsAgentConfig } from "../config/MetaAdsAgentConfig.js";
import type { AgentMemory, NewUnitAlert } from "../domain/entities/AgentMemory.js";
import { CampaignDecision } from "../domain/entities/CampaignDecision.js";
import { DecisionError } from "../domain/errors/index.js";
import type { ConfidenceScore } from "../domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../domain/value-objects/DecisionId.js";
import { DecisionReason } from "../domain/value-objects/DecisionReason.js";
import { DecisionType } from "../domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../domain/value-objects/ImpactEstimate.js";
import { performanceBaselineKey } from "../domain/value-objects/PerformanceBaseline.js";
import type { DecisionActionKind, PerAdFinding } from "../types/AgentTypes.js";

/**
 * Per-ad decision engine — SCALE/PAUSE/FIX/REFRESH/KEEP/REVIEW classification.
 *
 * PAUSE rule chain (ordered, first match wins) — see the package report for the full resolution
 * of the spec's prose-vs-Testing-Requirements ambiguity, extended by AAOS-W1D-S1S2 (S1) with a
 * new highest-priority evergreen-protection check inserted as step 2:
 *   1. spend === 0                                         → NO_ACTION  (nothing to save)
 *   2. [AAOS-W1D-S1S2 S1] memory.evergreenAds.has(ad.id)    → ESCALATE (unconditional — a proven
 *      long-term performer always gets a human look before pausing, regardless of how boros its
 *      numbers look; overrides every rule below, including #3/#4's AUTO_EXECUTE outcomes)
 *   3. spend > 0 && conversations === 0                     → AUTO_EXECUTE (wasted spend, zero engagement)
 *   4. rphChat > blendedAvgRphChat * autoExecutePauseRphMultiple → AUTO_EXECUTE (very clearly boros —
 *      takes precedence over #5 even when both match)
 *   5. rphChat > blendedAvgRphChat * escalateRphMultiple
 *      && spend > highSpendThresholdIDR                     → ESCALATE
 *   6. otherwise                                             → AUTO_EXECUTE (safe default — still a
 *      legitimate PAUSE verdict, none of the risk flags above triggered; see package report)
 *
 * `blendedAvgRphChat` (AAOS-W1D-S1S2 S1): when `memory` is supplied and a `PerformanceBaseline`
 * exists for `${finding.branch}-${finding.funnel}-${finding.angle}` with a defined `avgRphChat`,
 * the per-ad threshold comparisons above use `historicalAvgRphChat * 0.4 + currentAvgRphChatIDR *
 * 0.6` instead of the raw current-cycle average — otherwise unchanged. `finding.funnel`/`.angle`
 * are optional (see `AgentTypes.ts`), so this only activates for callers that supply them.
 *
 * SCALE: budgetIncrease <= maxAutoScaleBudgetIDR → AUTO_EXECUTE, else ESCALATE — extended by
 * AAOS-W1D-S1S2 (S2) with a stock-aware override: when `memory` is supplied and
 * `memory.inventoryByModel` shows zero units in stock for the ad's detected unit model, the
 * decision is overridden to `actionKind: "PAUSE"` / `DecisionType.AUTO_EXECUTE` (see the package
 * report for why "AUTO_PAUSE" is implemented this way rather than as a 5th `DecisionType`).
 * FIX: always AUTO_EXECUTE. REFRESH: always BRIEF_KAI. KEEP/REVIEW: always NO_ACTION.
 */
export class VerdictDecisionEngine {
  constructor(private readonly now: () => Date = () => new Date()) {}

  decideForAd(
    finding: PerAdFinding,
    avgRphChatIDR: number,
    config: MetaAdsAgentConfig,
    confidence: ConfidenceScore,
    memory?: AgentMemory,
  ): Result<CampaignDecision, DecisionError> {
    switch (finding.verdict) {
      case Verdict.PAUSE:
        return this.decidePause(finding, avgRphChatIDR, config, confidence, memory);
      case Verdict.SCALE:
        return this.decideScale(finding, config, confidence, memory);
      case Verdict.FIX:
        return this.buildDecision(
          finding,
          "FIX",
          DecisionType.AUTO_EXECUTE,
          "Objective salah selalu perlu diperbaiki",
          confidence,
          {
            description: "Objective diperbaiki ke funnel yang benar",
          },
        );
      case Verdict.REFRESH:
        return this.buildDecision(
          finding,
          "REFRESH",
          DecisionType.BRIEF_KAI,
          "Creative jenuh, perlu refresh",
          confidence,
          {
            description: "Brief dikirim ke Kai untuk creative baru",
          },
        );
      case Verdict.KEEP:
      case Verdict.REVIEW:
      default:
        return this.buildDecision(
          finding,
          "NO_ACTION",
          DecisionType.NO_ACTION,
          `Verdict ${String(finding.verdict)} — monitor only`,
          confidence,
          {
            description: "Tidak ada aksi, dipantau saja",
          },
        );
    }
  }

  private decidePause(
    finding: PerAdFinding,
    avgRphChatIDR: number,
    config: MetaAdsAgentConfig,
    confidence: ConfidenceScore,
    memory?: AgentMemory,
  ): Result<CampaignDecision, DecisionError> {
    if (finding.spendIDR === 0) {
      return this.buildDecision(
        finding,
        "PAUSE",
        DecisionType.NO_ACTION,
        "Spend Rp 0 — tidak ada yang bisa dihemat",
        confidence,
        {
          description: "Nothing to save",
        },
      );
    }

    // AAOS-W1D-S1S2 (S1) — evergreen protection: unconditional, takes precedence over every
    // PAUSE sub-rule below (wasted-spend, both threshold checks, and the safe default).
    if (memory?.evergreenAds.has(finding.adId)) {
      return this.buildDecision(
        finding,
        "PAUSE",
        DecisionType.ESCALATE,
        "Evergreen ad — escalate sebelum pause. Ad ini sudah terbukti perform > 60 hari",
        confidence,
        { description: `Potensi hemat ${formatIDR(finding.spendIDR)} — perlu review manual` },
      );
    }

    if (finding.spendIDR > 0 && finding.conversations === 0) {
      return this.buildDecision(
        finding,
        "PAUSE",
        DecisionType.AUTO_EXECUTE,
        `Spend ${formatIDR(finding.spendIDR)} tanpa satu pun percakapan — boros`,
        confidence,
        { description: `Hemat ${formatIDR(finding.spendIDR)}`, amountIDR: finding.spendIDR },
      );
    }

    const blendedAvgRphChatIDR = this.blendedAvgRphChat(finding, avgRphChatIDR, memory);
    const autoExecuteThreshold = Math.round(
      blendedAvgRphChatIDR * config.autoExecutePauseRphMultiple,
    );
    const escalateThreshold = Math.round(blendedAvgRphChatIDR * config.escalateRphMultiple);
    const rphChat = finding.rphChatIDR;

    if (rphChat !== null && rphChat > autoExecuteThreshold) {
      return this.buildDecision(
        finding,
        "PAUSE",
        DecisionType.AUTO_EXECUTE,
        `Rp/chat ${formatIDR(rphChat)} > ${config.autoExecutePauseRphMultiple}x avg (${formatIDR(autoExecuteThreshold)}) — sangat jelas boros`,
        confidence,
        { description: `Hemat ${formatIDR(finding.spendIDR)}`, amountIDR: finding.spendIDR },
      );
    }

    if (
      rphChat !== null &&
      rphChat > escalateThreshold &&
      finding.spendIDR > config.highSpendThresholdIDR
    ) {
      return this.buildDecision(
        finding,
        "PAUSE",
        DecisionType.ESCALATE,
        `Rp/chat ${formatIDR(rphChat)} > ${config.escalateRphMultiple}x avg (${formatIDR(escalateThreshold)}) dan spend ${formatIDR(finding.spendIDR)} > ${formatIDR(config.highSpendThresholdIDR)} — high-spend, butuh approval`,
        confidence,
        {
          description: `Potensi hemat ${formatIDR(finding.spendIDR)}`,
          amountIDR: finding.spendIDR,
        },
      );
    }

    return this.buildDecision(
      finding,
      "PAUSE",
      DecisionType.AUTO_EXECUTE,
      "Verdict PAUSE, tidak memicu kondisi risiko — auto-execute sebagai default aman",
      confidence,
      { description: `Hemat ${formatIDR(finding.spendIDR)}`, amountIDR: finding.spendIDR },
    );
  }

  private decideScale(
    finding: PerAdFinding,
    config: MetaAdsAgentConfig,
    confidence: ConfidenceScore,
    memory?: AgentMemory,
  ): Result<CampaignDecision, DecisionError> {
    // AAOS-W1D-S1S2 (S2) — stock-aware override: an out-of-stock unit is never scaled, regardless
    // of budget-increase size. Implemented as `actionKind: "PAUSE"` + `DecisionType.AUTO_EXECUTE`
    // ("AUTO_PAUSE" per the spec's prose — not a 5th `DecisionType`, see package report) rather
    // than SCALE, since pausing an out-of-stock unit's ad is unambiguously safe/routine.
    if (memory) {
      const stockCheck = this.checkStock(finding, memory);
      if (stockCheck) {
        return this.buildDecision(
          finding,
          "PAUSE",
          DecisionType.AUTO_EXECUTE,
          stockCheck,
          confidence,
          {
            description: `Pause otomatis — unit habis stok`,
          },
        );
      }
    }

    const budgetIncrease = finding.budgetIncreaseIDR ?? 0;
    if (budgetIncrease <= config.maxAutoScaleBudgetIDR) {
      return this.buildDecision(
        finding,
        "SCALE",
        DecisionType.AUTO_EXECUTE,
        `Kenaikan budget ${formatIDR(budgetIncrease)} <= batas aman ${formatIDR(config.maxAutoScaleBudgetIDR)}`,
        confidence,
        { description: `Naikkan budget ${formatIDR(budgetIncrease)}`, amountIDR: budgetIncrease },
        budgetIncrease,
      );
    }
    return this.buildDecision(
      finding,
      "SCALE",
      DecisionType.ESCALATE,
      `Kenaikan budget ${formatIDR(budgetIncrease)} > batas aman ${formatIDR(config.maxAutoScaleBudgetIDR)} — butuh approval`,
      confidence,
      {
        description: `Usulan naikkan budget ${formatIDR(budgetIncrease)}`,
        amountIDR: budgetIncrease,
      },
      budgetIncrease,
    );
  }

  /**
   * Detects the unit model from `finding.unit` (already classified upstream — see
   * `AgentTypes.ts`'s `PerAdFinding.unit`) and checks stock for that exact model IN THIS AD'S
   * BRANCH — matching the pinned business-correctness test ("Stargazer Bandung: 0 units in
   * inventory... reason includes 'Stargazer' and 'Bandung'"), which is a branch-scoped stock
   * check, not a global one (a Stargazer in stock at a different branch must not mask a Bandung
   * out-of-stock). Returns a ready-to-use PAUSE reason string when the model is known to
   * `memory.currentInventory` (present at ANY branch — i.e. a real, tracked model) but has zero
   * units at `finding.branch` specifically; `undefined` otherwise, including when the model is
   * entirely untracked (no scrape data for it at all — "unknown unit → assume in stock", per spec
   * pseudocode comment, since punishing untracked models would make S2 unsafe to enable
   * incrementally, unit-by-unit).
   */
  private checkStock(finding: PerAdFinding, memory: AgentMemory): string | undefined {
    const unitModel = finding.unit.trim();
    if (unitModel.length === 0) {
      return undefined;
    }
    const isKnownModel = memory.currentInventory.some((unit) => unit.matchesModel(unitModel));
    if (!isKnownModel) {
      return undefined;
    }
    const inStockAtBranch = memory.currentInventory.some(
      (unit) => unit.matchesModel(unitModel) && unit.branch === finding.branch,
    );
    if (inStockAtBranch) {
      return undefined;
    }
    return `Unit ${unitModel} habis stok di ${finding.branch} — pause campaign`;
  }

  /**
   * AAOS-W1D-S1S2 (S1) — blended avg: `historical.avgRphChat * 0.4 + currentCycleAvgRphChatIDR *
   * 0.6`, falling back to the raw current-cycle average when no baseline exists for this
   * ad's `${branch}-${funnel}-${angle}` (or the baseline has no `avgRphChat` recorded).
   */
  private blendedAvgRphChat(
    finding: PerAdFinding,
    currentCycleAvgRphChatIDR: number,
    memory?: AgentMemory,
  ): number {
    if (!memory || !finding.funnel || !finding.angle) {
      return currentCycleAvgRphChatIDR;
    }
    const key = performanceBaselineKey(finding.branch, finding.funnel, finding.angle);
    const baseline = memory.performanceBaselines.get(key);
    if (!baseline || baseline.avgRphChat === undefined) {
      return currentCycleAvgRphChatIDR;
    }
    return baseline.avgRphChat * 0.4 + currentCycleAvgRphChatIDR * 0.6;
  }

  /**
   * AAOS-W1D-S1S2 (S2) — new-unit-detected escalation. Portfolio-level (no single `Ad` target),
   * per the spec's own framing ("Pertimbangkan campaign baru atau tambahkan ke iklan existing") —
   * routed through the same `targetType: "portfolio"` shape the base package already uses for
   * `BudgetOptimizer`'s REALLOCATE_BUDGET/CREATE_CAMPAIGN portfolio findings (see
   * `CampaignDecisionBuilder.buildForPortfolio` / `AgentTypes.ts`'s `PortfolioFinding`), rather
   * than inventing a third decision-generating path.
   */
  decideNewUnitAlert(
    alert: NewUnitAlert,
    confidence: ConfidenceScore,
  ): Result<CampaignDecision, DecisionError> {
    const reasonResult = DecisionReason.create(
      `Unit baru masuk: ${alert.model} ${alert.year} di ${alert.branch}`,
    );
    /* v8 ignore next 4 */
    if (!reasonResult.ok) {
      // Unreachable: the template literal above is never empty (branch/year are always present).
      return err(new DecisionError(reasonResult.error.message));
    }
    const impactResult = ImpactEstimate.create({
      description: "Pertimbangkan campaign baru atau tambahkan ke iklan existing",
    });
    /* v8 ignore next 4 */
    if (!impactResult.ok) {
      // Unreachable: the description above is a non-empty literal.
      return err(new DecisionError(impactResult.error.message));
    }
    const decisionResult = CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: `new-unit-${alert.branch}-${alert.model}-${alert.year}`,
      targetType: "portfolio",
      actionKind: "CREATE_CAMPAIGN",
      decisionType: DecisionType.ESCALATE,
      reason: reasonResult.value,
      confidence,
      impact: impactResult.value,
      createdAt: this.now(),
    });
    /* v8 ignore next 4 */
    if (!decisionResult.ok) {
      // Unreachable: every field above is a valid literal/derived value — never externally supplied.
      return err(new DecisionError(decisionResult.error.message));
    }
    return ok(decisionResult.value);
  }

  private buildDecision(
    finding: PerAdFinding,
    actionKind: DecisionActionKind,
    decisionType: DecisionType,
    reasonText: string,
    confidence: ConfidenceScore,
    impactInput: { description: string; amountIDR?: number },
    budgetChangeIDR?: number,
  ): Result<CampaignDecision, DecisionError> {
    const reasonResult = DecisionReason.create(reasonText);
    /* v8 ignore next 5 */
    if (!reasonResult.ok) {
      // Unreachable: reasonText is always a non-empty template literal built from this file's own
      // switch/if branches above — never externally supplied, never empty.
      return err(new DecisionError(reasonResult.error.message));
    }
    const impactResult = ImpactEstimate.create(impactInput);
    if (!impactResult.ok) {
      return err(new DecisionError(impactResult.error.message));
    }
    const decisionResult = CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: finding.targetId,
      targetType: finding.targetType,
      actionKind,
      decisionType,
      verdict: finding.verdict,
      reason: reasonResult.value,
      confidence,
      impact: impactResult.value,
      budgetChangeIDR,
      spendIDR: finding.spendIDR,
      currentDailyBudgetIDR: actionKind === "SCALE" ? finding.currentDailyBudgetIDR : undefined,
      createdAt: this.now(),
    });
    if (!decisionResult.ok) {
      return err(new DecisionError(decisionResult.error.message));
    }
    return ok(decisionResult.value);
  }
}
