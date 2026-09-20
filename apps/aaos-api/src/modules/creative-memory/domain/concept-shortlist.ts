import type { AnglePerformanceResult } from "./angle-performance.js";

/**
 * EYVRA — SAMANTHA V2 + KAI V2 Phase 40 (PROMPT 51 — Mass Generation).
 *
 * RAW SPEC PROSE (verbatim, confirmed directly from the original transcript —
 * `21d7b50c-a24c-4a80-9a15-f6aca7543a22.jsonl`, the message containing the literal
 * "PROMPT 51 — MASS GENERATION" header):
 * ```
 * PROMPT 51 — MASS GENERATION
 *
 * Use two-stage workflow:
 *
 * 24 concepts
 * ↓
 * 24 low-cost previews
 * ↓
 * Kai shortlist
 * ↓
 * 8 concepts
 * ↓
 * production render
 *
 * Don't waste premium credits on every exploratory concept.
 * ```
 *
 * HONEST AUDIT CONCLUSION (Phase 40's own, verified fresh — do not trust the Phase 27 summary
 * alone): the spec's real two-stage shape is GENERATE-THEN-SHORTLIST — 24 real, cheap preview
 * IMAGES get generated first, then Kai visually reviews those 24 real renders to pick 8. Building
 * that literally requires two things this codebase genuinely does NOT have yet:
 *  1. A real cheap-image generation lever. Phase 36 (`GenerationQualityTier`,
 *     `packages/creative-connector/.../GenerationModel.ts`) only cheapens VIDEO generation
 *     (DRAFT tier -> `VEO3_FAST`) — there is still only one real image model
 *     (`nano-banana-pro`), so "24 low-cost previews" cannot be triggered honestly today.
 *  2. A real visual-quality-review mechanism to shortlist AFTER generation. Phase 31's semantic
 *     QA answers "does this generated image match the source property photo", a narrower and
 *     different question than "which of these 24 already-generated concepts looks best" — no
 *     vision-based cross-concept comparison capability exists anywhere in this codebase.
 * Building either of those honestly (rather than fabricating a fake image-quality score) is out
 * of scope for one phase and was explicitly ruled out by this phase's own brief.
 *
 * WHAT IS HONESTLY BUILDABLE TODAY: the spec's own underlying economic goal — "don't waste
 * premium credits on every exploratory concept" — can be served BEFORE any image is generated at
 * all, using a REAL signal this codebase already computes: `angle-performance.ts`'s
 * `rankAnglePerformance` (Phase 2), which ranks this tenant's real `PropertyAdAngle` values by
 * real historical CPL from already-published, already-linked `meta_insights_daily` rows, gated on
 * the SAME `dataSufficiency.level >= "MEDIUM"` bar that module already enforces (see its own
 * `isRankable`/`RANKABLE_MIN_LEVEL`). This file is a NEW, tiny, pure function
 * (`shortlistConcepts`) that reorders/narrows a set of candidate concepts (each carrying a real
 * `PropertyAdAngle`, e.g. the SAME shape `LlmService.generateDiverseCreativeBriefSet`'s briefs
 * already have) by that real per-angle historical rank — a PRE-GENERATION shortlist, not the
 * spec's literal post-generation one, spending zero real KIE.ai/Meta calls to do it.
 *
 * REAL, HONEST SCALE MISMATCH (stated explicitly, never glossed over): the spec's own numbers are
 * 24 candidates -> 8 shortlisted. This codebase's real, already-existing candidate-generation
 * ceiling (`MAX_DIVERSE_BRIEF_COUNT`, `llm/dto/diverse-creative-brief-set.dto.ts`) is 10, not 24 —
 * there is no real mechanism anywhere that produces 24 distinct candidate concepts for one
 * listing today. This function is therefore written generically over `readonly T[]` and a
 * `targetCount`, never hard-coded to 24/8, so it is honestly usable at whatever real candidate
 * count this codebase can actually produce (today, at most 10) without pretending a 24-candidate
 * capability exists.
 *
 * HONEST DEGRADE: when NONE of the candidates' angles have a real, rankable historical result
 * (brand-new tenant, brand-new angle, or every matching angle still below the `MEDIUM` data-
 * sufficiency bar), this returns the input UNCHANGED (only truncated to `targetCount`, never
 * reordered) with `method: "UNDIFFERENTIATED_FALLBACK"` — never a fabricated "best guess" order.
 * Candidates whose angle IS individually rankable are ranked first (best real CPL first, same
 * "ranked-then-unranked, each preserving its own relative order" convention
 * `rankAnglePerformance`/`rankAssetPerformance` already establish); candidates whose angle is not
 * individually rankable are appended after, in their original relative order, never dropped
 * silently, never force-ranked against a reliable one.
 *
 * NOT WIRED into `SchedulerService.createDiverseCreativeBriefSet` or any other call site this
 * phase (that orchestration file is explicitly out of scope to touch this phase beyond reading) —
 * left as a standalone, tested, pure domain function, the same "foundation now, wiring later once
 * there's a clear non-overlapping benefit" precedent Phase 34's `ConceptFamily` taxonomy already
 * set.
 *
 * ZERO Meta API calls, ZERO KIE.ai calls, ZERO mutation, ZERO new persistence — pure in-memory
 * ranking over data the caller already has.
 */

/** The minimal shape `shortlistConcepts` actually reads off each candidate — any real candidate/brief carrying a real `PropertyAdAngle` value satisfies this without adaptation. */
export interface ConceptShortlistCandidate {
  readonly angle: string;
}

export type ConceptShortlistMethod = "HISTORICAL_ANGLE_RANK" | "UNDIFFERENTIATED_FALLBACK";

export interface ConceptShortlistResult<T extends ConceptShortlistCandidate> {
  /** The narrowed, ordered shortlist — length `min(targetCount, candidates.length)`, never longer than the real input. */
  readonly shortlisted: readonly T[];
  /**
   * `"HISTORICAL_ANGLE_RANK"` when at least one candidate's angle had a real, rankable
   * (`dataSufficiency.level >= "MEDIUM"`) historical result to sort by. `"UNDIFFERENTIATED_FALLBACK"`
   * when none did — the honest "not enough real data yet" case, never a fabricated ranking.
   */
  readonly method: ConceptShortlistMethod;
  /** How many of the real input candidates had a genuinely rankable angle (0 when `method` is `"UNDIFFERENTIATED_FALLBACK"`). */
  readonly rankedCount: number;
  /** Indonesian, honest notes — e.g. how many candidates were dropped, or that no historical signal existed yet. Never a directive to blindly trust the order. */
  readonly notes: readonly string[];
}

/**
 * Narrows `candidates` down to at most `targetCount`, preferring candidates whose real
 * `PropertyAdAngle` has a real, rankable historical CPL result in `angleHistory` (the real output
 * of `rankAnglePerformance` for this tenant) — best real CPL first. Candidates whose angle has no
 * rankable entry in `angleHistory` (missing, or below the `MEDIUM` data-sufficiency bar) are kept,
 * appended after the ranked ones, in their original relative order — never dropped for lacking
 * data, only ever out-prioritized by candidates with real, reliable evidence.
 *
 * `angleHistory` is expected to already be deduplicated by angle (`rankAnglePerformance`'s own
 * real output shape — one `AnglePerformanceResult` per distinct angle). If a caller ever passes a
 * duplicate angle, the FIRST occurrence with a defined `rank` wins; a later duplicate is ignored
 * rather than silently overwriting a real ranked result with an unranked one.
 *
 * Returns a real, honest empty shortlist (never fabricated candidates) for empty `candidates` or a
 * non-positive `targetCount`.
 */
export function shortlistConcepts<T extends ConceptShortlistCandidate>(
  candidates: readonly T[],
  angleHistory: readonly AnglePerformanceResult[],
  targetCount: number,
): ConceptShortlistResult<T> {
  if (candidates.length === 0) {
    return {
      shortlisted: [],
      method: "UNDIFFERENTIATED_FALLBACK",
      rankedCount: 0,
      notes: ["Tidak ada kandidat concept untuk di-shortlist."],
    };
  }

  if (targetCount <= 0) {
    return {
      shortlisted: [],
      method: "UNDIFFERENTIATED_FALLBACK",
      rankedCount: 0,
      notes: [
        `targetCount tidak valid (${String(targetCount)}) — tidak ada concept yang di-shortlist.`,
      ],
    };
  }

  const rankByAngle = new Map<string, number>();
  for (const result of angleHistory) {
    if (result.rank === undefined) {
      continue;
    }
    if (rankByAngle.has(result.angle)) {
      continue;
    }
    rankByAngle.set(result.angle, result.rank);
  }

  const ranked: Array<{ readonly candidate: T; readonly rank: number }> = [];
  const unranked: T[] = [];
  for (const candidate of candidates) {
    const rank = rankByAngle.get(candidate.angle);
    if (rank === undefined) {
      unranked.push(candidate);
    } else {
      ranked.push({ candidate, rank });
    }
  }

  if (ranked.length === 0) {
    const shortlisted = candidates.slice(0, targetCount);
    const notes: string[] = [
      "Belum ada data historis performa angle yang cukup (real CPL, dataSufficiency >= MEDIUM) untuk salah satu kandidat — urutan asli dipertahankan tanpa diferensiasi.",
    ];
    if (candidates.length > targetCount) {
      notes.push(
        `${String(candidates.length - targetCount)} kandidat dipotong (melebihi target ${String(targetCount)}) tanpa prioritas nyata — tidak ada sinyal historis untuk memilih mana yang dibuang.`,
      );
    }
    return { shortlisted, method: "UNDIFFERENTIATED_FALLBACK", rankedCount: 0, notes };
  }

  const sortedRanked = [...ranked].sort((a, b) => a.rank - b.rank).map((entry) => entry.candidate);
  const combined = [...sortedRanked, ...unranked];
  const shortlisted = combined.slice(0, targetCount);

  const notes: string[] = [
    `${String(ranked.length)} dari ${String(candidates.length)} kandidat punya angle dengan data historis nyata (real CPL) yang cukup untuk diranking; sisanya dipertahankan tanpa prioritas di belakang.`,
  ];
  if (combined.length > targetCount) {
    notes.push(
      `${String(combined.length - targetCount)} kandidat dipotong (melebihi target ${String(targetCount)}) — prioritas real-CPL-terbaik dipertahankan.`,
    );
  }

  return { shortlisted, method: "HISTORICAL_ANGLE_RANK", rankedCount: ranked.length, notes };
}
