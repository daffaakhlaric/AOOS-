import type { GroupedObjection } from "./objection-grouping.js";
import { evidenceExistsInText } from "./objection-grouping.js";
import type {
  StressTestGoalImpact,
  StressTestObjectionResolutionItem,
  StressTestResolutionAdjustment,
  StressTestResolutionStatus,
} from "./stress-test-run.js";

/**
 * Creative Stress Test — server-side verification of the Objection Resolution evaluator's raw LLM
 * assessments. Pure, no I/O. The LLM's output is NEVER persisted as-is; these deterministic rules
 * run first:
 *
 * 1. EVIDENCE MUST LITERALLY EXIST. `RESOLVED`/`PARTIAL` are only kept when `evidence` is a
 *    substring of the real creative text after `normalizeForEvidenceMatch` (case/whitespace/quote/
 *    trailing-punctuation only). Otherwise the status is downgraded to `UNRESOLVED`, the evidence
 *    dropped, the recommendation replaced with a fixed honest sentence, and
 *    `adjustment: "EVIDENCE_NOT_FOUND"` recorded. For every other status a non-matching evidence
 *    quote is simply dropped (set to `null`).
 * 2. NO UNGROUNDED OFFERS. For `UNRESOLVED`/`PARTIAL`, if the recommendation mentions a term from
 *    `UNGROUNDED_TERM_RULES` (discount/promo/ROI/KPR terms/school distance/appreciation/urgency…)
 *    that appears NOWHERE in the grounding text (creative text + listing facts + knowledge
 *    excerpts), the fix needs a fact we don't have: status becomes `REQUIRES_KNOWLEDGE`, the
 *    recommendation becomes "Butuh data: <term> (belum ada di data listing/creative)", and
 *    `adjustment: "UNGROUNDED_TERM"` is recorded.
 * 3. `REQUIRES_KNOWLEDGE` recommendations always start with "Butuh data:" (prefixed if missing).
 * 4. Recommendations are capped at `MAX_RECOMMENDATION_LENGTH` characters (ellipsis).
 * 5. Only ids that map to a real grouped objection are kept; the first assessment per id wins;
 *    objections the LLM skipped get no item (the dashboard shows "Belum dinilai" for them).
 */

export const MAX_RECOMMENDATION_LENGTH = 100;

export const EVIDENCE_NOT_FOUND_RECOMMENDATION =
  "Bukti di creative tidak ditemukan — keberatan ini belum dijawab oleh teks creative.";

/**
 * Terms a recommendation may only use when the grounding text already contains them. Each rule's
 * `label` is what the "Butuh data: …" recommendation names. Matching is case-insensitive at a word
 * start (so "diskon" matches "diskonnya").
 */
export const UNGROUNDED_TERM_RULES: readonly {
  readonly label: string;
  readonly patterns: readonly string[];
}[] = [
  {
    label: "detail diskon/promo",
    patterns: ["diskon", "promo", "cashback", "potongan harga", "bonus", "gratis", "free"],
  },
  {
    label: "proyeksi ROI/imbal hasil",
    patterns: ["roi", "imbal hasil", "yield", "passive income", "capital gain"],
  },
  {
    label: "kenaikan nilai/apresiasi",
    patterns: [
      "apresiasi",
      "kenaikan nilai",
      "kenaikan harga",
      "nilai naik",
      "harga naik",
      "investasi menguntungkan",
    ],
  },
  {
    label: "skema KPR/cicilan",
    patterns: ["kpr", "cicilan", "angsuran", "bunga", "tenor", "dp ", "uang muka"],
  },
  { label: "jarak ke sekolah", patterns: ["sekolah"] },
  {
    label: "fasilitas",
    patterns: [
      "kolam renang",
      "clubhouse",
      "gym",
      "taman bermain",
      "one gate",
      "cctv",
      "security 24",
    ],
  },
  {
    label: "urgensi/stok terbatas",
    patterns: ["terbatas", "limited", "hari ini saja", "sisa unit", "stok"],
  },
];

const COMPILED_TERM_RULES = UNGROUNDED_TERM_RULES.map((rule) => ({
  label: rule.label,
  regexes: rule.patterns.map(
    (p) => new RegExp(`(^|[^a-z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
  ),
}));

/** First ungrounded term rule the recommendation triggers, or `undefined`. */
export function findUngroundedTerm(
  recommendation: string,
  groundingText: string,
): string | undefined {
  const rec = recommendation.toLowerCase();
  const grounding = groundingText.toLowerCase();
  for (const rule of COMPILED_TERM_RULES) {
    const hit = rule.regexes.find((re) => re.test(rec));
    if (hit !== undefined && !rule.regexes.some((re) => re.test(grounding))) {
      return rule.label;
    }
  }
  return undefined;
}

function capRecommendation(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > MAX_RECOMMENDATION_LENGTH
    ? `${trimmed.slice(0, MAX_RECOMMENDATION_LENGTH - 1).trimEnd()}…`
    : trimmed;
}

function ensureButuhData(text: string): string {
  return /^butuh data\s*:/i.test(text.trim()) ? text.trim() : `Butuh data: ${text.trim()}`;
}

export interface RawObjectionAssessment {
  readonly id: string;
  readonly resolutionStatus: StressTestResolutionStatus;
  readonly goalImpact: StressTestGoalImpact;
  readonly shortRecommendation: string;
  readonly evidence: string | null;
}

/** Stable per-run id the prompt uses for each grouped objection ("o1", "o2", …). */
export function objectionPromptId(index: number): string {
  return `o${String(index + 1)}`;
}

export function verifyObjectionAssessments(input: {
  readonly objections: readonly GroupedObjection[];
  readonly assessments: readonly RawObjectionAssessment[];
  readonly creativeText: string;
  readonly groundingText: string;
}): readonly StressTestObjectionResolutionItem[] {
  const byId = new Map<string, GroupedObjection>();
  input.objections.forEach((o, i) => byId.set(objectionPromptId(i), o));
  const seen = new Set<string>();
  const items: StressTestObjectionResolutionItem[] = [];

  for (const raw of input.assessments) {
    const objection = byId.get(raw.id);
    if (objection === undefined || seen.has(raw.id)) continue;
    seen.add(raw.id);

    let status = raw.resolutionStatus;
    let recommendation = raw.shortRecommendation;
    let adjustment: StressTestResolutionAdjustment | undefined;
    const evidenceFound =
      raw.evidence !== null &&
      raw.evidence.trim().length > 0 &&
      evidenceExistsInText(raw.evidence, input.creativeText);
    let evidence: string | null =
      evidenceFound && raw.evidence !== null ? raw.evidence.trim() : null;

    if ((status === "RESOLVED" || status === "PARTIAL") && !evidenceFound) {
      status = "UNRESOLVED";
      evidence = null;
      recommendation = EVIDENCE_NOT_FOUND_RECOMMENDATION;
      adjustment = "EVIDENCE_NOT_FOUND";
    } else if (status === "UNRESOLVED" || status === "PARTIAL") {
      const term = findUngroundedTerm(recommendation, input.groundingText);
      if (term !== undefined) {
        status = "REQUIRES_KNOWLEDGE";
        recommendation = `Butuh data: ${term} (belum ada di data listing/creative)`;
        adjustment = "UNGROUNDED_TERM";
      }
    }

    if (status === "REQUIRES_KNOWLEDGE") {
      recommendation = ensureButuhData(recommendation);
    }

    items.push({
      key: objection.key,
      objection: objection.objection,
      resolutionStatus: status,
      goalImpact: raw.goalImpact,
      shortRecommendation: capRecommendation(recommendation),
      evidence,
      ...(adjustment !== undefined ? { adjustment } : {}),
    });
  }
  return items;
}
