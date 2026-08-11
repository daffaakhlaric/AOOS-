import { ScoreDelta, type ScoringCriterion } from "../domain/value-objects/ScoreDelta.js";

export interface ScoringRule {
  readonly criterion: ScoringCriterion;
  readonly score: number;
  readonly detect: (messageText: string) => boolean;
}

const BUDGET_PATTERN = /\d+\s*(juta|jt|rb|ribu)/i;
const UNIT_PATTERN = /xpander|brio|avanza|raize|rush|stargazer/i;
const LOCATION_PATTERN = /dimana|lokasi|cabang|showroom|bintaro|cinere/i;
const CASH_PATTERN = /cash|tunai|kontan/i;
const KREDIT_PATTERN = /kredit|cicil|nyicil|angsuran/i;
const TIMELINE_PATTERN = /minggu ini|bulan ini|segera|sekarang/i;
const NAME_PATTERN = /nama (saya|aku|gue)/i;
const NOT_SERIOUS_PATTERN = /cuma tanya|liat-liat|lihat-lihat|belum pasti|nanti dulu/i;

/**
 * The exact `SCORING_RULES` table from the spec's "Lead Scoring Engine" — each rule pairs a
 * `ScoringCriterion` with its point value and a pure `detect` predicate over one message's text.
 * `NO_REPLY`'s `detect: () => false` is intentional (design resolution #3): it is never triggered
 * by this per-message loop — the timeout-driven `-10` penalty lives in
 * `application/services/FollowUpService.ts`, applied via an injectable clock, not message text.
 */
export const SCORING_RULES: ReadonlyArray<ScoringRule> = [
  { criterion: "BUDGET", score: 25, detect: (msg) => BUDGET_PATTERN.test(msg) },
  { criterion: "UNIT", score: 25, detect: (msg) => UNIT_PATTERN.test(msg) },
  { criterion: "AREA", score: 25, detect: (msg) => LOCATION_PATTERN.test(msg) },
  {
    criterion: "PAYMENT",
    score: 25,
    detect: (msg) => CASH_PATTERN.test(msg) || KREDIT_PATTERN.test(msg),
  },
  { criterion: "TIMELINE", score: 10, detect: (msg) => TIMELINE_PATTERN.test(msg) },
  { criterion: "NAME", score: 10, detect: (msg) => NAME_PATTERN.test(msg) },
  { criterion: "NO_REPLY", score: -10, detect: () => false },
  { criterion: "NOT_SERIOUS", score: -20, detect: (msg) => NOT_SERIOUS_PATTERN.test(msg) },
];

/** Pure math over `SCORING_RULES` — given one message's text, returns every `ScoreDelta` that fires (a message can trigger multiple rules at once). */
export class ScoreCalculator {
  static calculate(messageText: string): ScoreDelta[] {
    return SCORING_RULES.filter((rule) => rule.detect(messageText)).map((rule) =>
      ScoreDelta.of(rule.criterion, rule.score),
    );
  }

  /** The single `ScoreDelta` for the timeout-driven `NO_REPLY` penalty (design resolution #3) — never derived from `detect`. */
  static noReplyDelta(): ScoreDelta {
    return ScoreDelta.of("NO_REPLY", -10);
  }
}
