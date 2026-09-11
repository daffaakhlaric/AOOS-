import type { Ad } from "../entities/Ad.js";
import type { CreativeAsset } from "../value-objects/CreativeAsset.js";

/**
 * `scoreCreativeDiversity` (Samantha Andromeda-Aware Campaign System, Sprint 1) — pure,
 * synchronous, no I/O, the SAME "pure business-rule evaluation with no I/O" shape/placement
 * `VerdictEngine.evaluateVerdict` (this file's own sibling) already establishes: a
 * `domain/services/` pure-function module, not a class needing DI.
 *
 * REAL BACKGROUND: Meta's "Andromeda" retrieval engine (rolled out ~Oct 2025) means creative
 * diversity WITHIN one ad set now matters more than audience-targeting fragmentation — "1
 * campaign -> 1 ad set -> many DIVERSE creatives" outperforms "many narrowly-targeted ad sets".
 * This function is the honest, adapted core of that idea: it scores how DIVERSE a real campaign's
 * ad creatives actually are, using ONLY signals this codebase already has.
 *
 * TAXONOMY DECISION (investigated directly before writing this — the single most important design
 * call in this file): the original pasted spec's `evaluateCreativeSet` scored diversity off
 * fabricated per-ad fields (`hookType`, `targetPersona`, `messageAngle`) that do not exist
 * anywhere in this codebase's real data model. Two real candidates were investigated as honest
 * replacements:
 *   1. `packages/creative-agent`'s `PropertyAdAngle` enum (DP_RINGAN/READY_HUNI/INVESTASI/...) —
 *      a real, already-established creative taxonomy. REJECTED for THIS function: `PropertyAdAngle`
 *      lives on `creative_packages` rows (Kai's brief/generation domain, in `apps/aaos-api`), not
 *      on `@aos/meta-ads-connector`'s `Ad` entity — a real Meta `Ad`, as pulled/synced from Meta
 *      itself, carries no `angle` field at all, and there is no reliable, already-built join from a
 *      live Meta ad back to the specific `creative_packages` row that produced it at THIS package's
 *      layer (that mapping is a `apps/aaos-api` scheduler-level concern, not something
 *      `@aos/meta-ads-connector` — a hard-constrained, already-shipped, independently-verified
 *      package this session generally avoids invasively modifying — should reach into).
 *   2. `Ad.creativeAsset` (this package's own real, already-shipped `CreativeAsset` value object —
 *      `{kind:"IMAGE", imageHash}` or `{kind:"VIDEO", videoId}`, pulled straight from Meta's real
 *      `creative{image_hash,video_id}` expansion). ACCEPTED: literal same-asset detection is real,
 *      honest, and needs no cross-package reach — two ads sharing the exact same `imageHash`/
 *      `videoId` are, by construction, not diverse creatives, regardless of what copy/targeting
 *      wraps them. This is a narrower, MORE conservative diversity signal than a full angle
 *      taxonomy would give (it can't tell two DIFFERENT photos of the same angle apart), which is
 *      the honest tradeoff for using only data that is actually, verifiably present today.
 *
 * HONEST DEGRADE (matches `evaluateFatigue`/`evaluateNeedCreative`'s own "never fabricate a
 * decision from missing data" discipline): `NOT_ENOUGH_DATA` is a first-class, real result —
 * returned whenever there are too few real ads to say anything meaningful, or when none of the
 * real ads carry a `creativeAsset` at all (nothing to dedup) — NEVER a fabricated numeric score.
 */

/**
 * Minimum total real ads across a campaign before a diversity score is honestly computable at
 * all — judgment call, documented the same way `fatigue.ts`'s own thresholds are: below this, 1-2
 * ads tell you almost nothing about whether a campaign's creative SET is diverse, so this function
 * honestly degrades to `NOT_ENOUGH_DATA` rather than compute a score off a near-empty sample.
 */
export const MIN_ADS_FOR_DIVERSITY_SCORE = 3;

/**
 * `distinctCreativeAssetCount / totalAdCount` at or below this ratio is real, honest
 * `LOW_DIVERSITY` — judgment call: e.g. 3 distinct assets spread across 6 ads (ratio 0.5) means,
 * on average, every real creative asset is being reused by at least 2 ads — a real, literal
 * "not very diverse" signal, not a fabricated one.
 */
export const LOW_DIVERSITY_RATIO_THRESHOLD = 0.5;

export type CreativeDiversityStatus = "NOT_ENOUGH_DATA" | "LOW_DIVERSITY" | "DIVERSE";

export interface CreativeDiversityScore {
  readonly status: CreativeDiversityStatus;
  /** Real count of ads this score was computed over (always defined, even for `NOT_ENOUGH_DATA`). */
  readonly totalAdCount: number;
  /**
   * Real, honest count of DISTINCT creative assets (deduped by `IMAGE:<hash>`/`VIDEO:<id>`) among
   * the ads that actually carry a real `creativeAsset`. `undefined` exactly when `status` is
   * `NOT_ENOUGH_DATA` (never fabricated) — see this module's own header doc.
   */
  readonly distinctCreativeAssetCount?: number;
  /** Real, honest, human-readable reasoning — always references the real numbers behind the status. */
  readonly reasoning: string;
}

function creativeAssetKey(asset: CreativeAsset): string {
  return asset.kind === "IMAGE" ? `IMAGE:${asset.imageHash}` : `VIDEO:${asset.videoId}`;
}

export function scoreCreativeDiversity(ads: ReadonlyArray<Ad>): CreativeDiversityScore {
  const totalAdCount = ads.length;

  if (totalAdCount < MIN_ADS_FOR_DIVERSITY_SCORE) {
    return {
      status: "NOT_ENOUGH_DATA",
      totalAdCount,
      reasoning: `Hanya ${String(totalAdCount)} ad di campaign ini — minimal ${String(MIN_ADS_FOR_DIVERSITY_SCORE)} ad diperlukan untuk menghitung diversity score yang jujur.`,
    };
  }

  const assetsWithCreative = ads
    .map((ad) => ad.creativeAsset)
    .filter((asset): asset is CreativeAsset => asset !== undefined);

  if (assetsWithCreative.length === 0) {
    return {
      status: "NOT_ENOUGH_DATA",
      totalAdCount,
      reasoning: `${String(totalAdCount)} ad ada, tapi tidak satupun punya creativeAsset (image_hash/video_id) real dari Meta — tidak bisa menghitung diversity secara jujur.`,
    };
  }

  const distinctCreativeAssetCount = new Set(assetsWithCreative.map(creativeAssetKey)).size;
  const ratio = distinctCreativeAssetCount / totalAdCount;

  if (ratio <= LOW_DIVERSITY_RATIO_THRESHOLD) {
    return {
      status: "LOW_DIVERSITY",
      totalAdCount,
      distinctCreativeAssetCount,
      reasoning: `${String(distinctCreativeAssetCount)} creative asset unik dari ${String(totalAdCount)} ad (rasio ${ratio.toFixed(2)}) — di bawah ambang ${String(LOW_DIVERSITY_RATIO_THRESHOLD)}, banyak ad memakai creative asset yang sama persis (gaya Andromeda: konsolidasi ke 1 ad set dengan kreatif lebih diverse akan lebih efektif daripada mempertahankan banyak ad set sempit).`,
    };
  }

  return {
    status: "DIVERSE",
    totalAdCount,
    distinctCreativeAssetCount,
    reasoning: `${String(distinctCreativeAssetCount)} creative asset unik dari ${String(totalAdCount)} ad (rasio ${ratio.toFixed(2)}) — sudah cukup diverse, di atas ambang ${String(LOW_DIVERSITY_RATIO_THRESHOLD)}.`,
  };
}
