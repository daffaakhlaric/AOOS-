import type { SimulationResult } from "@aos/conversation-simulator";

import type { IDimensionScorer } from "../contracts/IDimensionScorer.js";
import type { AppliedRule, DimensionScore } from "../domain/entities/DimensionScore.js";
import { DimensionName } from "../domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../domain/value-objects/DimensionScoreValue.js";

import { jessyMessages } from "./SpeakerFilter.js";
import {
  BULLET_OR_NUMBERED_LIST_PATTERN,
  CASUAL_WORDS_PATTERN,
  EMOJI_PATTERN,
  FORMAL_PHRASE_PATTERN,
  ROBOT_GREETING_PATTERN,
} from "./TextPatterns.js";

/** Dimension 1 — does Jessy sound human or robotic? (spec "Dimension 1 — Natural Language", weight 20%). */
export class NaturalLanguageScorer implements IDimensionScorer {
  score(simulationResult: SimulationResult): DimensionScore {
    const jessy = jessyMessages(simulationResult.messages);
    const rules: AppliedRule[] = [];

    if (jessy.length === 0) {
      rules.push({
        rule: "NO_JESSY_MESSAGES",
        points: 0,
        note: "Jessy tidak mengirim pesan apa pun untuk dinilai.",
      });
      return {
        dimension: DimensionName.NATURAL_LANGUAGE,
        score: DimensionScoreValue.of(0),
        appliedRules: rules,
      };
    }

    const allConcise = jessy.every((m) => m.text.length <= 150);
    rules.push({
      rule: "CONCISE",
      points: allConcise ? 2 : 0,
      note: allConcise
        ? "Semua pesan Jessy ringkas (<=150 karakter)."
        : this.longestMessageNote(jessy),
    });

    const anyEmoji = jessy.some((m) => EMOJI_PATTERN.test(m.text));
    rules.push({
      rule: "USES_EMOJI",
      points: anyEmoji ? 2 : 0,
      note: anyEmoji
        ? "Jessy memakai emoji."
        : "Jessy tidak pernah memakai emoji (😊🙏✅) di percakapan ini.",
    });

    const anyCasual = jessy.some((m) => CASUAL_WORDS_PATTERN.test(m.text));
    rules.push({
      rule: "CASUAL_WORDS",
      points: anyCasual ? 2 : 0,
      note: anyCasual
        ? "Jessy memakai kata informal."
        : "Jessy tidak pakai kata informal (kak, nih, deh, dong, sih) di percakapan ini.",
    });

    const noFormalPhrases = jessy.every((m) => !FORMAL_PHRASE_PATTERN.test(m.text));
    rules.push({
      rule: "NO_FORMAL_PHRASES",
      points: noFormalPhrases ? 2 : 0,
      note: noFormalPhrases
        ? "Tidak ada frasa formal kaku."
        : "Jessy memakai frasa formal kaku ('Dengan hormat'/'Perkenalkan').",
    });

    const hasRepeat = this.hasConsecutiveRepeat(jessy);
    rules.push({
      rule: "VARIED_RESPONSES",
      points: !hasRepeat ? 2 : 0,
      note: !hasRepeat
        ? "Respons Jessy bervariasi antar turn."
        : "Ada respons Jessy yang identik dua turn berturut-turut.",
    });

    const anyTooLong = jessy.some((m) => m.text.length > 300);
    rules.push({
      rule: "TOO_LONG",
      points: anyTooLong ? -3 : 0,
      note: anyTooLong
        ? this.longestMessageNote(jessy)
        : "Tidak ada pesan Jessy yang lebih dari 300 karakter.",
    });

    const anyBullets = jessy.some((m) => BULLET_OR_NUMBERED_LIST_PATTERN.test(m.text));
    rules.push({
      rule: "BULLET_OR_LIST",
      points: anyBullets ? -2 : 0,
      note: anyBullets
        ? "Jessy memakai bullet point/list bernomor — terasa robotik."
        : "Tidak ada bullet point/list.",
    });

    /* v8 ignore next -- `jessy[0]` is always defined here: the `jessy.length === 0` early-return above already handles the empty case, so this optional chain's `undefined` branch is unreachable under `noUncheckedIndexedAccess`. */
    const startsRobotic = ROBOT_GREETING_PATTERN.test(jessy[0]?.text ?? "");
    rules.push({
      rule: "ROBOT_GREETING",
      points: startsRobotic ? -2 : 0,
      note: startsRobotic
        ? "Pesan pertama Jessy dibuka dengan sapaan robotik 'Halo, saya Jessy dari Mobix By DSS Motor'."
        : "Sapaan pembuka tidak robotik.",
    });

    rules.push({
      rule: "SAME_PATTERN_TWO_IN_A_ROW",
      points: hasRepeat ? -1 : 0,
      note: hasRepeat
        ? "Pesan ke-3 dst mengulang pola yang sama dua turn berturut-turut."
        : "Tidak ada pengulangan pola.",
    });

    const total = rules.reduce((sum, r) => sum + r.points, 0);
    return {
      dimension: DimensionName.NATURAL_LANGUAGE,
      score: DimensionScoreValue.of(total),
      appliedRules: rules,
    };
  }

  private hasConsecutiveRepeat(jessy: SimulationResult["messages"]): boolean {
    for (let i = 1; i < jessy.length; i += 1) {
      if (jessy[i]?.text === jessy[i - 1]?.text) {
        return true;
      }
    }
    return false;
  }

  private longestMessageNote(jessy: SimulationResult["messages"]): string {
    const longest = [...jessy].sort((a, b) => b.text.length - a.text.length)[0];
    /* v8 ignore next -- `longest` is always defined here: every caller only reaches this helper when `jessy` is non-empty, so the `??` fallbacks' branch is unreachable under `noUncheckedIndexedAccess`. */
    return `Pesan turn ke-${longest?.turn ?? 0} terlalu panjang (${longest?.text.length ?? 0} karakter). Target maksimal 150 karakter.`;
  }
}
