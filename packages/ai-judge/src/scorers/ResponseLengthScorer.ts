import type { SimulationResult } from "@aos/conversation-simulator";

import type { IDimensionScorer } from "../contracts/IDimensionScorer.js";
import type { AppliedRule, DimensionScore } from "../domain/entities/DimensionScore.js";
import { DimensionName } from "../domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../domain/value-objects/DimensionScoreValue.js";

import { jessyMessages } from "./SpeakerFilter.js";

/** Dimension 6 — are Jessy's responses appropriately concise? (spec "Dimension 6 — Response Length", weight 10%). */
export class ResponseLengthScorer implements IDimensionScorer {
  score(simulationResult: SimulationResult): DimensionScore {
    const avg = simulationResult.avgJessyResponseLength;
    const max = simulationResult.maxJessyResponseLength;
    const longCount = jessyMessages(simulationResult.messages).filter(
      (m) => m.text.length > 250,
    ).length;

    const rules: AppliedRule[] = [];

    if (avg <= 150) {
      rules.push({
        rule: "AVG_VERY_CONCISE",
        points: 4,
        note: `Rata-rata panjang respons Jessy ${avg} karakter — sangat ringkas (<=150).`,
      });
    } else if (avg <= 200) {
      rules.push({
        rule: "AVG_CONCISE",
        points: 3,
        note: `Rata-rata panjang respons Jessy ${avg} karakter — ringkas (151-200).`,
      });
    } else if (avg <= 250) {
      rules.push({
        rule: "AVG_ACCEPTABLE",
        points: 2,
        note: `Rata-rata panjang respons Jessy ${avg} karakter — cukup (201-250).`,
      });
    } else {
      rules.push({
        rule: "AVG_TOO_LONG",
        points: 0,
        note: `Rata-rata panjang respons Jessy ${avg} karakter — terlalu panjang (>250).`,
      });
    }

    const overSoftLimit = max > 300;
    rules.push({
      rule: "MAX_OVER_300",
      points: overSoftLimit ? -2 : 0,
      note: overSoftLimit
        ? `Pesan terpanjang ${max} karakter — lebih dari 300 karakter.`
        : "Tidak ada pesan yang melebihi 300 karakter.",
    });

    const overHardLimit = max > 400;
    rules.push({
      rule: "MAX_OVER_400",
      points: overHardLimit ? -3 : 0,
      note: overHardLimit
        ? `Pesan terpanjang ${max} karakter — wall of text (>400).`
        : "Tidak ada pesan yang melebihi 400 karakter.",
    });

    const tooManyLong = longCount > 2;
    rules.push({
      rule: "MORE_THAN_TWO_LONG_MESSAGES",
      points: tooManyLong ? -1 : 0,
      note: tooManyLong
        ? `${longCount} pesan Jessy lebih dari 250 karakter — perlu dipotong.`
        : `${longCount} pesan Jessy lebih dari 250 karakter — masih dalam batas wajar.`,
    });

    const total = rules.reduce((sum, r) => sum + r.points, 0);
    return {
      dimension: DimensionName.RESPONSE_LENGTH,
      score: DimensionScoreValue.of(total),
      appliedRules: rules,
    };
  }
}
