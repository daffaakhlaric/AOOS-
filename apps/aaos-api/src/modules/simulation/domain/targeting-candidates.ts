import type { StoredMetaInterest } from "../../meta-interests/domain/meta-interest.js";

/**
 * How many real stored interests are shown to Samantha in one `selectTargeting` call. Kept well
 * under `SelectTargetingRequestSchema`'s hard `max(40)` — the coordinator note is explicit that the
 * LLM must get a focused candidate set, never "the whole table".
 */
export const MAX_TARGETING_CANDIDATES = 20;

/**
 * Angle → finance-relevance rule. DSS Motor's `DP_RINGAN` (light down-payment) and
 * `KREDIT_SYARIAH` (sharia financing) angles are financing pitches, so a real interest about
 * credit/lending is genuinely more relevant for them than for, say, `TESTIMONIAL`. These are the
 * literal substrings checked against the real `AdAngle` member names.
 */
const FINANCE_ANGLE_MARKERS: readonly string[] = ["DP_", "KREDIT", "SYARIAH"];

/** Words a real Meta interest name/search term uses for financing (all captured live: "car finance (credit and lending)"). */
const FINANCE_INTEREST_MARKERS: readonly string[] = ["finance", "credit", "lending", "loan"];

/** Tokens too generic to carry relevance signal from a unit name (Indonesian + English filler). */
const STOP_TOKENS: ReadonlySet<string> = new Set([
  "the",
  "dan",
  "mobil",
  "unit",
  "type",
  "tipe",
  "new",
  "baru",
]);

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token));
}

function scoreInterest(
  interest: StoredMetaInterest,
  unitTokens: readonly string[],
  wantsFinance: boolean,
): number {
  const haystack = `${interest.name} ${interest.searchTerm} ${interest.topic ?? ""}`.toLowerCase();
  let score = 0;
  for (const token of unitTokens) {
    if (haystack.includes(token)) {
      // A unit-name hit is the strongest available signal that this interest is about this car.
      score += 3;
    }
  }
  if (wantsFinance && FINANCE_INTEREST_MARKERS.some((marker) => haystack.includes(marker))) {
    score += 2;
  }
  return score;
}

/**
 * Picks the real stored `meta_interests` rows worth showing Samantha for one simulation
 * (AAOS-SIMULASI-TARGETING).
 *
 * Deliberately a simple, inspectable keyword/topic filter — not an embedding search, not a second
 * LLM call. The coordinator note asks for exactly this ("a simple keyword/topic filter against the
 * unit is enough"), and a transparent scoring rule is auditable in a way a similarity score is
 * not.
 *
 * IMPORTANT — a zero score is not a disqualification. Every row in `meta_interests` got there by a
 * curated automotive/financing/family search term, so an interest that simply doesn't share a word
 * with the unit name (e.g. "Used car (vehicle)" vs unit "Xpander") is still a perfectly reasonable
 * candidate. Scoring therefore ORDERS the candidates rather than filtering them out; the only
 * thing that removes a row is falling past `limit`. Ties break on Meta's own upper audience bound,
 * largest first, so the most reachable audiences lead.
 *
 * Returns an empty array only when there are genuinely no stored interests — which the caller
 * reports honestly as `NO_CANDIDATES` rather than inventing one.
 */
export function selectTargetingCandidates(
  stored: readonly StoredMetaInterest[],
  context: { readonly unit: string; readonly angle?: string },
  limit: number = MAX_TARGETING_CANDIDATES,
): readonly StoredMetaInterest[] {
  const unitTokens = tokenize(context.unit);
  const angle = (context.angle ?? "").toUpperCase();
  const wantsFinance = FINANCE_ANGLE_MARKERS.some((marker) => angle.includes(marker));

  return [...stored]
    .map((interest) => ({
      interest,
      score: scoreInterest(interest, unitTokens, wantsFinance),
    }))
    .sort(
      (a, b) => b.score - a.score || b.interest.audienceSizeUpper - a.interest.audienceSizeUpper,
    )
    .slice(0, limit)
    .map((scored) => scored.interest);
}
