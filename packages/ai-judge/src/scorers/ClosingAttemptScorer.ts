import type { SimulationResult } from "@aos/conversation-simulator";
import { ConversationStage } from "@aos/sales-agent";

import type { IDimensionScorer } from "../contracts/IDimensionScorer.js";
import type { AppliedRule, DimensionScore } from "../domain/entities/DimensionScore.js";
import { DimensionName } from "../domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../domain/value-objects/DimensionScoreValue.js";

import { JESSY_SPEAKER } from "./SpeakerFilter.js";
import { ABRUPT_CLOSING_PATTERN, CLOSING_INTENT_PATTERN } from "./TextPatterns.js";

/** Dimension 4 — did Jessy push toward test drive/survey? (spec "Dimension 4 — Closing Attempt", weight 20%). */
export class ClosingAttemptScorer implements IDimensionScorer {
  score(simulationResult: SimulationResult): DimensionScore {
    const closingTransition = simulationResult.stageTransitions.find(
      (t) => t.to === ConversationStage.CLOSING,
    );
    const closingReached = closingTransition !== undefined;
    const rules: AppliedRule[] = [];

    if (closingReached) {
      rules.push({
        rule: "CLOSING_ATTEMPTED",
        points: 4,
        note: `Jessy mencoba closing pada turn ke-${closingTransition.turn}.`,
      });
    } else {
      rules.push({
        rule: "NO_CLOSING_ATTEMPT",
        points: 0,
        note: "Jessy tidak pernah mencapai CLOSING stage.",
      });
    }

    const closingMessages = closingReached
      ? simulationResult.messages.filter(
          (m) => m.speaker === JESSY_SPEAKER && m.turn >= closingTransition.turn,
        )
      : [];
    const closingMessage = closingMessages[0];
    const closingText = closingMessage?.text ?? "";

    const mentionsClosingIntent = closingReached && CLOSING_INTENT_PATTERN.test(closingText);
    rules.push({
      rule: "MENTIONS_CLOSING_INTENT",
      points: mentionsClosingIntent ? 3 : 0,
      note: mentionsClosingIntent
        ? "Pesan closing menyebut test drive/survei/jadwal."
        : closingReached
          ? "Pesan closing tidak menyebut test drive/survei/jadwal."
          : "Tidak ada pesan closing untuk dievaluasi.",
    });

    const closingBeforeTurn10 = closingReached && closingTransition.turn <= 10;
    rules.push({
      rule: "CLOSING_NOT_TOO_LATE",
      points: closingBeforeTurn10 ? 2 : 0,
      note: closingBeforeTurn10
        ? "Closing terjadi sebelum turn ke-10 — tidak terlambat."
        : closingReached
          ? `Closing baru terjadi di turn ke-${closingTransition.turn} — terlalu lambat.`
          : "Tidak ada closing untuk dievaluasi ketepatan waktunya.",
    });

    const isNatural =
      closingReached && closingText.length > 15 && !ABRUPT_CLOSING_PATTERN.test(closingText);
    rules.push({
      rule: "CLOSING_IS_NATURAL",
      points: isNatural ? 1 : 0,
      note: isNatural
        ? "Pesan closing terasa natural, tidak abrupt."
        : closingReached
          ? `Pesan closing terlalu formal — '${closingText}'`
          : "Tidak ada pesan closing untuk dievaluasi kealamiannya.",
    });

    const warmOrHotNoClosing = !closingReached && simulationResult.finalScore >= 40;
    rules.push({
      rule: "NO_CLOSING_ON_WARM_LEAD",
      points: warmOrHotNoClosing ? -3 : 0,
      note: warmOrHotNoClosing
        ? `Jessy tidak mencoba closing meski lead sudah WARM (score ${simulationResult.finalScore}).`
        : "Tidak berlaku: lead tidak cukup WARM, atau closing sudah dicoba.",
    });

    const closingOnColdLead = closingReached && simulationResult.finalScore < 20;
    rules.push({
      rule: "CLOSING_ON_COLD_LEAD",
      points: closingOnColdLead ? -2 : 0,
      note: closingOnColdLead
        ? `Closing dicoba pada lead COLD (score ${simulationResult.finalScore}) — terlalu pushy.`
        : "Tidak berlaku: lead tidak COLD, atau tidak ada closing.",
    });

    const duplicateClosingMessages = closingReached && this.hasDuplicate(closingMessages);
    rules.push({
      rule: "SPAMMY_DUPLICATE_CLOSING",
      points: duplicateClosingMessages ? -1 : 0,
      note: duplicateClosingMessages
        ? "Ada beberapa pesan closing yang identik — terasa spammy."
        : "Tidak ada pesan closing yang berulang identik.",
    });

    const total = rules.reduce((sum, r) => sum + r.points, 0);
    return {
      dimension: DimensionName.CLOSING_ATTEMPT,
      score: DimensionScoreValue.of(total),
      appliedRules: rules,
    };
  }

  private hasDuplicate(messages: SimulationResult["messages"]): boolean {
    const seen = new Set<string>();
    for (const m of messages) {
      if (seen.has(m.text)) {
        return true;
      }
      seen.add(m.text);
    }
    return false;
  }
}
