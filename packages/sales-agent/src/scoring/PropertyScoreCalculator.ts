import {
  PropertyScoreDelta,
  type PropertyScoringCriterion,
} from "../domain/value-objects/PropertyScoreDelta.js";

export interface PropertyScoringRule {
  readonly criterion: PropertyScoringCriterion;
  readonly score: number;
  readonly question: string;
  readonly detect: (messageText: string) => boolean;
}

const BUDGET_PATTERN = /\d+\s*(juta|jt|m|miliar)/i;
const PROPERTY_TYPE_PATTERN = /rumah|apartemen|apart|ruko|tanah|kavling|villa/i;
const AREA_PATTERN = /dimana|lokasi|area|kawasan|bintaro|cinere|jakarta|bandung|surabaya/i;
const PAYMENT_PATTERN = /kpr|cash|tunai|cicilan|kredit/i;
const TIMELINE_PATTERN = /minggu ini|bulan ini|segera|sekarang|tahun ini/i;
const BEDROOMS_PATTERN = /\d+\s*(kamar|kt|bed\s*room)|kamar\s*\d+/i;

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 (spec Part 6's `PROPERTY_QUALIFICATION`) — the
 * PROPERTY vertical's sibling table to `SCORING_RULES` (`ScoreCalculator.ts`), same shape and
 * discipline: each rule pairs a criterion with its point value, real Indonesian-language question
 * copy (spec-pinned verbatim), and a pure `detect` predicate over one message's text.
 *
 * Point values and question copy are pinned exactly to spec Part 6:
 * BUDGET(+20) PROPERTY_TYPE(+15) AREA(+20) PAYMENT(+15) TIMELINE(+20) BEDROOMS(+10) — total 100
 * when every dimension fires once, matching automotive's `SCORING_RULES`' own "sums to 100"
 * design.
 *
 * SCOPE NOTE: this table is a real, independently testable qualification-scoring config — it does
 * NOT yet replace `ScoreCalculator`/`LeadScorer`'s real per-message call site in
 * `ConversationEngine`/`ConversationPipeline` with a vertical-aware dispatch (that integration,
 * plus a PROPERTY-specific `StageDetector`/`ResponseGenerator`, is real, substantial follow-on
 * work deferred out of this phase — see the coordinator report). `PropertyScoreCalculator` is
 * ready to be wired the same way `ScoreCalculator` already is once that follow-on lands.
 */
export const PROPERTY_SCORING_RULES: ReadonlyArray<PropertyScoringRule> = [
  {
    criterion: "BUDGET",
    score: 20,
    question: "Budget propertinya berapa kak? Beli cash atau KPR?",
    detect: (msg) => BUDGET_PATTERN.test(msg),
  },
  {
    criterion: "PROPERTY_TYPE",
    score: 15,
    question: "Mau cari rumah, apartemen, atau ruko kak?",
    detect: (msg) => PROPERTY_TYPE_PATTERN.test(msg),
  },
  {
    criterion: "AREA",
    score: 20,
    question: "Mau di area mana kak?",
    detect: (msg) => AREA_PATTERN.test(msg),
  },
  {
    criterion: "PAYMENT",
    score: 15,
    question: "Rencana KPR atau cash kak?",
    detect: (msg) => PAYMENT_PATTERN.test(msg),
  },
  {
    criterion: "TIMELINE",
    score: 20,
    question: "Rencana beli kapan kak?",
    detect: (msg) => TIMELINE_PATTERN.test(msg),
  },
  {
    criterion: "BEDROOMS",
    score: 10,
    question: "Butuh berapa kamar tidur kak?",
    detect: (msg) => BEDROOMS_PATTERN.test(msg),
  },
];

/** Pure math over `PROPERTY_SCORING_RULES` — mirrors `ScoreCalculator.calculate`. */
export class PropertyScoreCalculator {
  static calculate(messageText: string): PropertyScoreDelta[] {
    return PROPERTY_SCORING_RULES.filter((rule) => rule.detect(messageText)).map((rule) =>
      PropertyScoreDelta.of(rule.criterion, rule.score),
    );
  }
}

/**
 * Spec Part 6's thresholds (HOT >=65, WARM 30-64, COLD <30) — deliberately reuses the REAL
 * existing `classifyTemperature`/`LeadTemperature` from `domain/value-objects/LeadTemperature.ts`
 * rather than inventing a second temperature enum; only the `warmThreshold` differs from
 * automotive's spec-pinned default (30 here vs automotive's 31 — both codified explicitly, never
 * silently reused across verticals). Callers: `classifyTemperature(score, 30, 65)`.
 */
export const PROPERTY_WARM_THRESHOLD = 30;
export const PROPERTY_HOT_THRESHOLD = 65;
