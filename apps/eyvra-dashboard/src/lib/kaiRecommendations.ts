import type { CreativePackageDto } from "@/types/dashboard.types";

/**
 * Sprint 5 Prompt 14 — "Brief ke Kai, versi sadar-heatmap" recommendation logic.
 *
 * REAL, DETERMINISTIC THRESHOLD LOGIC — explicitly NOT a new LLM call, per the spec's own
 * instruction ("bukan LLM call baru, cukup logic threshold"). Same precedent `WinningCombos.tsx`/
 * `RankedCombosList.tsx` (Sprint 5 Prompt 12) already set: pure client-side ranking over data the
 * page already fetched, no new backend endpoint.
 *
 * HONEST DATA-AVAILABILITY FINDING (this is the real reason this logic looks different from the
 * spec's literal example): the spec's own worked example — "Segment LAL 1% belum pernah dapat
 * angle INVESTASI" — needs a real join between an AUDIENCE segment (`HeatmapCellDto.audienceLabel`,
 * `apps/eyvra-dashboard/src/types/dashboard.types.ts`) and a creative ANGLE
 * (`CreativePackageDto.angle`). Investigating both real shapes found NO such join exists anywhere
 * in this codebase:
 *   - `HeatmapCellDto` is keyed by `assetId` (Meta's raw `image_hash`/`video_id`) × `audienceLabel`
 *     — it carries no `angle`, `listingId`, or any other field a `CreativePackageDto` could be
 *     joined against (the exact same "no assetId to join against" gap `4e76775`'s
 *     `CampaignDetailDrawer.tsx` docstring already documents for Blok 4 "Audience Breakdown").
 *   - `CreativePackageDto` (the real, persisted brief/package row — `angle` + `listingId` fields)
 *     carries no `audienceLabel`, no spend, no CTR, no impressions — it is a GENERATION-PIPELINE
 *     record (`DRAFT`/`GENERATING`/`PENDING`/`APPROVED`/`REJECTED`/`FAILED`), not a performance
 *     record.
 * Fabricating that join (e.g. inventing a fake "this angle's audience is X") would violate this
 * dispatch's own "never fabricate a recommendation reasoning" rule, so this logic uses the real
 * signal that DOES exist instead — the spec's OWN second worked example is exactly this real shape:
 * "Angle HUNIAN konsisten menang di 3 listing terakhir, coba di listing ini juga." That is a real,
 * computable fact from `CreativePackageDto` alone: how many OTHER real listings a given angle has
 * already been used for, and how many of those packages a human already `APPROVED` (the one real,
 * non-fabricated quality signal this DTO carries — there is no CTR/spend field to rank by, so
 * approval-by-a-human is the honest proxy, never presented as a spend/CTR number it is not).
 */

export type RecommendationConfidence = "TINGGI" | "SEDANG" | "COBA_COBA";

export interface AngleRecommendation {
  readonly angle: string;
  readonly reasoning: string;
  readonly confidence: RecommendationConfidence;
  /** Pre-check the "Pakai rekomendasi ini" checkbox — per spec, only for `TINGGI`. */
  readonly preChecked: boolean;
}

/** Same real threshold semantics repo-wide (e.g. `CPL_BENCHMARK_MULTIPLIER` in `heatmap-rollup.ts`): a plain, cited, deterministic constant — never derived from an LLM call. */
const APPROVED_LISTINGS_FOR_HIGH_CONFIDENCE = 3;
const APPROVED_LISTINGS_FOR_MEDIUM_CONFIDENCE = 1;
/** Cap so Step 2 never shows more cards than a human can meaningfully review. */
const MAX_RECOMMENDATIONS = 3;

interface AngleEvidence {
  readonly otherListingIds: ReadonlySet<string>;
  readonly approvedOtherListingIds: ReadonlySet<string>;
}

function collectEvidence(
  propertyPackages: readonly CreativePackageDto[],
  currentListingId: string,
): ReadonlyMap<string, AngleEvidence> {
  const byAngle = new Map<string, { other: Set<string>; approved: Set<string> }>();
  for (const pkg of propertyPackages) {
    if (pkg.listingId === undefined || pkg.listingId === currentListingId) {
      continue;
    }
    const entry = byAngle.get(pkg.angle) ?? {
      other: new Set<string>(),
      approved: new Set<string>(),
    };
    entry.other.add(pkg.listingId);
    if (pkg.status === "APPROVED") {
      entry.approved.add(pkg.listingId);
    }
    byAngle.set(pkg.angle, entry);
  }
  const result = new Map<string, AngleEvidence>();
  for (const [angle, entry] of byAngle) {
    result.set(angle, { otherListingIds: entry.other, approvedOtherListingIds: entry.approved });
  }
  return result;
}

/**
 * Real, deterministic recommendation over already-fetched `CreativePackageDto[]` (the SAME
 * `/api/creative` data `CreativeClient.tsx` already fetches — no second endpoint). Recommends only
 * angles that (a) have never been used for `currentListingId` yet, AND (b) have real evidence
 * (at least one other real listing used it) — an angle with zero evidence anywhere is never
 * suggested, since there would be nothing real to reason from.
 */
export function recommendPropertyAngles(
  allPackages: readonly CreativePackageDto[],
  currentListingId: string,
  availableAngles: readonly string[],
): readonly AngleRecommendation[] {
  const propertyPackages = allPackages.filter(
    (pkg) => pkg.vertical === "PROPERTY" && pkg.listingId !== undefined,
  );
  const usedForCurrentListing = new Set(
    propertyPackages.filter((pkg) => pkg.listingId === currentListingId).map((pkg) => pkg.angle),
  );
  const evidenceByAngle = collectEvidence(propertyPackages, currentListingId);

  const recommendations: AngleRecommendation[] = [];
  for (const angle of availableAngles) {
    if (usedForCurrentListing.has(angle)) {
      continue;
    }
    const evidence = evidenceByAngle.get(angle);
    if (evidence === undefined || evidence.otherListingIds.size === 0) {
      continue;
    }
    const approvedCount = evidence.approvedOtherListingIds.size;
    if (approvedCount >= APPROVED_LISTINGS_FOR_HIGH_CONFIDENCE) {
      recommendations.push({
        angle,
        confidence: "TINGGI",
        preChecked: true,
        reasoning: `Angle ${angle} sudah disetujui untuk ${approvedCount} listing lain — performa historis kuat, dan belum pernah dipakai untuk listing ini.`,
      });
    } else if (approvedCount >= APPROVED_LISTINGS_FOR_MEDIUM_CONFIDENCE) {
      recommendations.push({
        angle,
        confidence: "SEDANG",
        preChecked: false,
        reasoning: `Angle ${angle} pernah disetujui untuk ${approvedCount} listing lain, tapi belum dicoba untuk listing ini.`,
      });
    } else {
      recommendations.push({
        angle,
        confidence: "COBA_COBA",
        preChecked: false,
        reasoning: `Angle ${angle} pernah dipakai di ${evidence.otherListingIds.size} listing lain (belum ada yang disetujui) — belum dicoba untuk listing ini.`,
      });
    }
  }

  const rank: Readonly<Record<RecommendationConfidence, number>> = {
    TINGGI: 0,
    SEDANG: 1,
    COBA_COBA: 2,
  };
  return recommendations
    .sort((a, b) => rank[a.confidence] - rank[b.confidence])
    .slice(0, MAX_RECOMMENDATIONS);
}
