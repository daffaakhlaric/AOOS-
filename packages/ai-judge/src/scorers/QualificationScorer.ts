import type { SimulationResult } from "@aos/conversation-simulator";
import { ConversationStage, LeadTemperature } from "@aos/sales-agent";

import type { IDimensionScorer } from "../contracts/IDimensionScorer.js";
import type { AppliedRule, DimensionScore } from "../domain/entities/DimensionScore.js";
import { DimensionName } from "../domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../domain/value-objects/DimensionScoreValue.js";

type ScoringCriterion = "BUDGET" | "UNIT" | "AREA" | "PAYMENT" | "TIMELINE" | "NAME";

function hasFlag(simulationResult: SimulationResult, criterion: ScoringCriterion): boolean {
  return simulationResult.scoreProgression.some((entry) => entry.reason === criterion);
}

/**
 * Dimension 2 — did Jessy extract the 4 key qualification criteria? (spec "Dimension 2 —
 * Qualification", weight 25%). Ground truth for each flag is `SimulationResult.scoreProgression`
 * entries whose `reason` is the literal criterion name Jessy's own `ScoreCalculator`/
 * `SCORING_RULES` produces (`SimulationRunnerService` copies `payload.criterion` verbatim into
 * `reason` — see `application/services/SimulationRunnerService.ts`), not a re-derivation from raw
 * message text.
 */
export class QualificationScorer implements IDimensionScorer {
  score(simulationResult: SimulationResult): DimensionScore {
    const budget = hasFlag(simulationResult, "BUDGET");
    const unit = hasFlag(simulationResult, "UNIT");
    const area = hasFlag(simulationResult, "AREA");
    const payment = hasFlag(simulationResult, "PAYMENT");
    const timeline = hasFlag(simulationResult, "TIMELINE");
    const name = hasFlag(simulationResult, "NAME");

    const coreFlags = [budget, unit, area, payment];
    const coreCount = coreFlags.filter(Boolean).length;

    const rules: AppliedRule[] = [
      {
        rule: "BUDGET_EXTRACTED",
        points: budget ? 2.5 : 0,
        note: budget ? "Budget berhasil diekstrak." : "Budget tidak berhasil diekstrak dari lead.",
      },
      {
        rule: "UNIT_EXTRACTED",
        points: unit ? 2.5 : 0,
        note: unit ? "Unit berhasil diekstrak." : "Unit tidak berhasil diekstrak dari lead.",
      },
      {
        rule: "AREA_EXTRACTED",
        points: area ? 2.5 : 0,
        note: area
          ? "Area/lokasi berhasil diekstrak."
          : "Jessy tidak berhasil extract area/lokasi dari lead.",
      },
      {
        rule: "PAYMENT_EXTRACTED",
        points: payment ? 2.5 : 0,
        note: payment
          ? "Metode pembayaran berhasil diekstrak."
          : "Metode pembayaran tidak berhasil diekstrak dari lead.",
      },
      {
        rule: "TIMELINE_BONUS",
        points: timeline ? 1 : 0,
        note: timeline
          ? "Bonus: timeline juga diekstrak."
          : "Timeline tidak diekstrak (bonus tidak didapat).",
      },
      {
        rule: "NAME_BONUS",
        points: name ? 1 : 0,
        note: name
          ? "Bonus: nama lead juga diekstrak."
          : "Nama lead tidak diekstrak (bonus tidak didapat).",
      },
    ];

    // Design resolution #2: for COLD-expected personas with zero core flags, score the attempt,
    // not the (impossible-by-persona-design) success.
    if (simulationResult.expectedOutcome === LeadTemperature.COLD && coreCount === 0) {
      const attempted = simulationResult.stageTransitions.some(
        (t) => t.to === ConversationStage.DISCOVERY || t.to === ConversationStage.QUALIFICATION,
      );
      const attemptRule: AppliedRule = {
        rule: "COLD_QUALIFYING_ATTEMPT",
        points: attempted ? 5 : 0,
        note: attempted
          ? "Persona COLD/GHOST: Jessy tetap mencoba bertanya kualifikasi meski lead tidak menjawab."
          : "Persona COLD/GHOST: Jessy tidak mencoba bertanya kualifikasi sama sekali.",
      };
      return {
        dimension: DimensionName.QUALIFICATION,
        score: DimensionScoreValue.of(attempted ? 5 : 0),
        appliedRules: [...rules, attemptRule],
      };
    }

    const total = rules.reduce((sum, r) => sum + r.points, 0);
    return {
      dimension: DimensionName.QUALIFICATION,
      score: DimensionScoreValue.of(total),
      appliedRules: rules,
    };
  }
}
