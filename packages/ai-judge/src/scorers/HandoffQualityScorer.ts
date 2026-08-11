import type { SimulationResult } from "@aos/conversation-simulator";
import { LeadTemperature } from "@aos/sales-agent";

import type { IDimensionScorer } from "../contracts/IDimensionScorer.js";
import type { AppliedRule, DimensionScore } from "../domain/entities/DimensionScore.js";
import { DimensionName } from "../domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../domain/value-objects/DimensionScoreValue.js";

import { JESSY_SPEAKER } from "./SpeakerFilter.js";
import {
  CASUAL_WORDS_PATTERN,
  EMOJI_PATTERN,
  FORMAL_PHRASE_PATTERN,
  SALES_TEAM_MENTION_PATTERN,
} from "./TextPatterns.js";

const HANDOFF_TEMPERATURE_THRESHOLD = 65;

/** Dimension 5 — quality of HOT-lead handoff (spec "Dimension 5 — Handoff Quality", weight 10%). */
export class HandoffQualityScorer implements IDimensionScorer {
  score(simulationResult: SimulationResult): DimensionScore {
    if (!simulationResult.handoffTriggered) {
      const neededButMissing = simulationResult.finalTemperature === LeadTemperature.HOT;
      return {
        dimension: DimensionName.HANDOFF_QUALITY,
        score: DimensionScoreValue.of(neededButMissing ? 0 : 10),
        appliedRules: [
          neededButMissing
            ? {
                rule: "HOT_LEAD_NO_HANDOFF",
                points: 0,
                note: "Lead mencapai HOT tapi tidak ada handoff.",
              }
            : {
                rule: "NO_HANDOFF_NEEDED",
                points: 10,
                note: "Lead tidak mencapai HOT — tidak ada handoff, dan itu benar (N/A).",
              },
        ],
      };
    }

    const handoffTurn = simulationResult.handoffAtTurn ?? 0;
    const scoreAtHandoff = this.scoreAtOrBefore(simulationResult, handoffTurn);
    const handoffMessage =
      simulationResult.messages.find(
        (m) => m.speaker === JESSY_SPEAKER && m.turn === handoffTurn,
      ) ??
      simulationResult.messages.find((m) => m.speaker === JESSY_SPEAKER && m.turn >= handoffTurn);
    const text = handoffMessage?.text ?? "";
    const isWarm =
      (CASUAL_WORDS_PATTERN.test(text) || EMOJI_PATTERN.test(text)) &&
      !FORMAL_PHRASE_PATTERN.test(text);
    const mentionsSalesTeam = SALES_TEAM_MENTION_PATTERN.test(text);
    const correctThreshold = scoreAtHandoff >= HANDOFF_TEMPERATURE_THRESHOLD;

    const rules: AppliedRule[] = [
      {
        rule: "CORRECT_THRESHOLD",
        points: correctThreshold ? 4 : 0,
        note: correctThreshold
          ? `Handoff terjadi di score ${scoreAtHandoff} — pada/di atas threshold 65.`
          : `Handoff triggered di score ${scoreAtHandoff} — terlalu awal, threshold harusnya 65.`,
      },
      {
        rule: "WARM_MESSAGE",
        points: isWarm ? 3 : 0,
        note: isWarm
          ? "Pesan handoff terasa hangat, tidak abrupt."
          : "Pesan handoff terasa robotik/formal.",
      },
      {
        rule: "REASONABLE_TURNS",
        points: handoffTurn <= 10 ? 2 : 0,
        note:
          handoffTurn <= 10
            ? "Handoff terjadi dalam jumlah turn yang wajar (<=10)."
            : `Handoff baru terjadi di turn ke-${handoffTurn} — terlalu lama.`,
      },
      {
        rule: "MENTIONS_SALES_TEAM",
        points: mentionsSalesTeam ? 1 : 0,
        note: mentionsSalesTeam
          ? "Pesan handoff menyebut tim sales ('tim kita')."
          : "Pesan handoff tidak menyebut tim sales.",
      },
      {
        rule: "PREMATURE_HANDOFF",
        points: !correctThreshold ? -3 : 0,
        note: !correctThreshold
          ? `Handoff triggered di score ${scoreAtHandoff} — di bawah threshold 65 (prematur).`
          : "Handoff tidak prematur.",
      },
      {
        rule: "ROBOTIC_MESSAGE",
        points: !isWarm ? -2 : 0,
        note: !isWarm ? "Pesan handoff robotik/formal." : "Pesan handoff tidak robotik.",
      },
    ];

    const total = rules.reduce((sum, r) => sum + r.points, 0);
    return {
      dimension: DimensionName.HANDOFF_QUALITY,
      score: DimensionScoreValue.of(total),
      appliedRules: rules,
    };
  }

  private scoreAtOrBefore(simulationResult: SimulationResult, turn: number): number {
    const entries = simulationResult.scoreProgression.filter((e) => e.turn <= turn);
    const last = entries[entries.length - 1];
    return last?.score ?? simulationResult.finalScore;
  }
}
