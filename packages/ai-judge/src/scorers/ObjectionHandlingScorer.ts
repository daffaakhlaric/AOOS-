import type { SimulationResult } from "@aos/conversation-simulator";
import { ConversationStage } from "@aos/sales-agent";

import type { IDimensionScorer } from "../contracts/IDimensionScorer.js";
import type { AppliedRule, DimensionScore } from "../domain/entities/DimensionScore.js";
import { DimensionName } from "../domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../domain/value-objects/DimensionScoreValue.js";

import { hasObjectionSignal } from "./ObjectionSignalPatterns.js";
import { buyerMessages, JESSY_SPEAKER } from "./SpeakerFilter.js";
import { MOBIX_USP_PATTERN, PUSHY_PATTERN } from "./TextPatterns.js";

/**
 * Dimension 3 — did Jessy handle hesitation/complaints well? (spec "Dimension 3 — Objection
 * Handling", weight 15%). Implements design resolution #1 (see docs/AAOS-AI-JUDGE-REPORT.md):
 * "objection present" is independently ground-truthed by scanning the lead's own incoming
 * messages (`SimulationMessage.speaker === "BUYER"`) against `hasObjectionSignal`, never by
 * checking whether Jessy's own `stageTransitions`/`jessyHandledObjection` already say so — that
 * would make the "-3 missed objection" rule structurally unreachable.
 */
export class ObjectionHandlingScorer implements IDimensionScorer {
  score(simulationResult: SimulationResult): DimensionScore {
    const buyer = buyerMessages(simulationResult.messages);
    const objectionMessage = buyer.find((m) => hasObjectionSignal(m.text));

    if (!objectionMessage) {
      return {
        dimension: DimensionName.OBJECTION_HANDLING,
        score: DimensionScoreValue.of(10),
        appliedRules: [
          {
            rule: "NO_OBJECTION_PRESENT",
            points: 10,
            note: "Tidak ada sinyal objection/hesitation dari lead — N/A, skor sempurna secara default.",
          },
        ],
      };
    }

    const enteredObjectionStage = simulationResult.stageTransitions.some(
      (t) => t.to === ConversationStage.OBJECTION && t.turn >= objectionMessage.turn,
    );
    const response = simulationResult.messages.find(
      (m) => m.speaker === JESSY_SPEAKER && m.turn > objectionMessage.turn,
    );
    const responseText = response?.text ?? "";
    const mentionsUsp = MOBIX_USP_PATTERN.test(responseText);
    const isPushy = PUSHY_PATTERN.test(responseText);
    const isConcise = responseText.length > 0 && responseText.length <= 200;
    const isWallOfText = responseText.length > 300;

    const rules: AppliedRule[] = [];

    if (enteredObjectionStage) {
      rules.push({
        rule: "ENTERED_OBJECTION_STAGE",
        points: 4,
        note: "Jessy masuk OBJECTION stage — StageDetector bekerja dengan baik.",
      });
    } else {
      rules.push({
        rule: "MISSED_OBJECTION_STAGE",
        points: -3,
        note: `Jessy tidak masuk OBJECTION stage meski lead bilang "${objectionMessage.text}".`,
      });
    }

    rules.push({
      rule: "MENTIONS_MOBIX_USP",
      points: mentionsUsp ? 3 : 0,
      note: mentionsUsp
        ? "Response objection menyebut USP Mobix (Otospector/150 titik/garansi)."
        : "Response objection tidak menyebut Otospector atau inspeksi 150 titik.",
    });

    rules.push({
      rule: "EMPATHETIC",
      points: !isPushy ? 2 : 0,
      note: !isPushy
        ? "Response terasa empatik, tidak defensif/pushy."
        : "Response objection terasa pushy, bukan empatik.",
    });

    rules.push({
      rule: "CONCISE_OBJECTION_RESPONSE",
      points: isConcise ? 1 : 0,
      note: isConcise
        ? "Response objection ringkas (<=200 karakter)."
        : "Response objection tidak ringkas (>200 karakter atau kosong).",
    });

    rules.push({
      rule: "PUSHY_RESPONSE",
      points: isPushy ? -2 : 0,
      note: isPushy
        ? "Response objection memakai kalimat pushy ('harus beli sekarang'/'stok terbatas banget')."
        : "Tidak ada kalimat pushy.",
    });

    rules.push({
      rule: "WALL_OF_TEXT",
      points: isWallOfText ? -1 : 0,
      note: isWallOfText
        ? `Response objection terlalu panjang (${responseText.length} karakter) — wall of text.`
        : "Response objection tidak wall-of-text.",
    });

    const total = rules.reduce((sum, r) => sum + r.points, 0);
    return {
      dimension: DimensionName.OBJECTION_HANDLING,
      score: DimensionScoreValue.of(total),
      appliedRules: rules,
    };
  }
}
