import { PropertyAdAngle } from "../domain/value-objects/PropertyAdAngle.js";

/**
 * Kai Creative Engine Sprint 1 — real, data-driven angle-strength scoring. Investigated directly
 * before writing this: a large externally-pasted spec asked for angle strength scored off fields
 * this codebase's real `Listing` domain does not have (`kpr_available`/`kpr_installment` — no KPR
 * field exists anywhere on `ListingResponseDto`/`CreateListingBodySchema`) and off a 10-value angle
 * vocabulary that duplicates, under different names, the real, already-shipped 8-value
 * `PropertyAdAngle` enum every other Kai module (`PropertyCopyBuilder`, `PropertyFormatDecider`,
 * `createDiverseCreativeBriefSet`) already uses. This scorer reuses that SAME real enum and scores
 * strictly off fields `ListingResponseDto` actually has.
 *
 * HONEST DEGRADE (same discipline `scoreCreativeDiversity`/`evaluateFatigue` already establish
 * elsewhere in this codebase): an angle is only returned when a REAL signal backs it. `TESTIMONIAL`
 * is never returned by this scorer at all — this codebase has no per-listing review/testimonial
 * data anywhere, so there is no honest way to score it (Kai's LLM-based brief generation may still
 * pick it; this scorer simply never claims a data-backed strength for it). `SYARIAH` is only
 * returned when the listing's own free text actually says so — never assumed from `propertyType`
 * alone.
 */

/** Minimal, already-available `Listing` fields this scorer needs — deliberately NOT `ListingResponseDto` itself (this package must not depend on `apps/aaos-api`'s DTO layer), same "plain, already-validated struct" shape `PropertyCreativeBrief` already establishes. */
export interface PropertyListingAngleSignals {
  readonly propertyType: string;
  readonly price?: number;
  readonly buildArea?: number;
  readonly condition?: string;
  readonly certificate?: string;
  readonly description?: string;
  readonly highlights: readonly string[];
  readonly photoCount: number;
}

export interface PropertyAngleStrength {
  readonly angle: PropertyAdAngle;
  /** 0-100, always backed by a real signal named in `reasoning` — never a fabricated/default value. */
  readonly strength: number;
  readonly reasoning: string;
}

const READY_HUNI_KEYWORDS = ["siap huni", "ready", "baru", "renovasi total"];
const SYARIAH_KEYWORDS = ["syariah", "syari'ah", "shariah"];
const PROMO_KEYWORDS = ["promo", "terbatas", "limited", "diskon", "cashback"];
const INVESTASI_KEYWORDS = ["investasi", "investment", "capital gain"];
const INVESTABLE_PROPERTY_TYPES = ["TANAH", "RUKO", "APARTEMEN"];

/** A campaign only reasonably supports a walkthrough-style `VIRTUAL_TOUR` creative once there is enough real visual material to cut one together from — judgment call, matching `MIN_ADS_FOR_DIVERSITY_SCORE`'s own "small, documented minimum" discipline. */
const MIN_PHOTOS_FOR_VIRTUAL_TOUR = 5;

function containsAny(haystack: string | undefined, needles: readonly string[]): boolean {
  if (haystack === undefined) {
    return false;
  }
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function scoreDpRingan(listing: PropertyListingAngleSignals): PropertyAngleStrength | undefined {
  if (listing.price === undefined) {
    return undefined;
  }
  const BAWAH_500JT = 500_000_000;
  const BAWAH_1M = 1_000_000_000;
  const BAWAH_2M = 2_000_000_000;
  const strength =
    listing.price < BAWAH_500JT
      ? 90
      : listing.price < BAWAH_1M
        ? 75
        : listing.price < BAWAH_2M
          ? 55
          : 35;
  return {
    angle: PropertyAdAngle.DP_RINGAN,
    strength,
    reasoning: `Harga Rp${listing.price.toLocaleString("id-ID")} — semakin terjangkau, semakin kuat angle DP ringan.`,
  };
}

function scoreReadyHuni(listing: PropertyListingAngleSignals): PropertyAngleStrength | undefined {
  if (
    !containsAny(listing.condition, READY_HUNI_KEYWORDS) &&
    !containsAny(listing.description, READY_HUNI_KEYWORDS)
  ) {
    return undefined;
  }
  return {
    angle: PropertyAdAngle.READY_HUNI,
    strength: 80,
    reasoning: "Kondisi/deskripsi listing menyebutkan siap huni.",
  };
}

function scoreInvestasi(listing: PropertyListingAngleSignals): PropertyAngleStrength | undefined {
  const typeMatch = INVESTABLE_PROPERTY_TYPES.includes(listing.propertyType.toUpperCase());
  const textMatch = containsAny(listing.description, INVESTASI_KEYWORDS);
  if (!typeMatch && !textMatch) {
    return undefined;
  }
  return {
    angle: PropertyAdAngle.INVESTASI,
    strength: typeMatch ? 75 : 60,
    reasoning: typeMatch
      ? `Tipe properti ${listing.propertyType} secara umum lebih investable.`
      : "Deskripsi listing menyebutkan nilai investasi.",
  };
}

function scoreExclusive(listing: PropertyListingAngleSignals): PropertyAngleStrength | undefined {
  const PREMIUM_PRICE = 2_000_000_000;
  const LARGE_BUILD_AREA = 200;
  const MANY_HIGHLIGHTS = 5;
  const isPremiumPrice = listing.price !== undefined && listing.price >= PREMIUM_PRICE;
  const isLargeBuild = listing.buildArea !== undefined && listing.buildArea >= LARGE_BUILD_AREA;
  const hasManyHighlights = listing.highlights.length >= MANY_HIGHLIGHTS;
  if (!isPremiumPrice && !isLargeBuild && !hasManyHighlights) {
    return undefined;
  }
  const signalCount = [isPremiumPrice, isLargeBuild, hasManyHighlights].filter(Boolean).length;
  return {
    angle: PropertyAdAngle.EXCLUSIVE,
    strength: 50 + signalCount * 15,
    reasoning: `Sinyal eksklusif: ${[
      isPremiumPrice ? "harga premium" : undefined,
      isLargeBuild ? `LB ${String(listing.buildArea)}m²` : undefined,
      hasManyHighlights ? `${String(listing.highlights.length)} highlight` : undefined,
    ]
      .filter((s): s is string => s !== undefined)
      .join(", ")}.`,
  };
}

function scoreSyariah(listing: PropertyListingAngleSignals): PropertyAngleStrength | undefined {
  if (
    !containsAny(listing.description, SYARIAH_KEYWORDS) &&
    !containsAny(listing.certificate, SYARIAH_KEYWORDS)
  ) {
    return undefined;
  }
  return {
    angle: PropertyAdAngle.SYARIAH,
    strength: 80,
    reasoning: "Listing secara eksplisit menyebutkan skema syariah.",
  };
}

function scorePromoTerbatas(
  listing: PropertyListingAngleSignals,
): PropertyAngleStrength | undefined {
  if (!containsAny(listing.description, PROMO_KEYWORDS)) {
    return undefined;
  }
  return {
    angle: PropertyAdAngle.PROMO_TERBATAS,
    strength: 85,
    reasoning: "Deskripsi listing menyebutkan promo/unit terbatas.",
  };
}

function scoreVirtualTour(listing: PropertyListingAngleSignals): PropertyAngleStrength | undefined {
  if (listing.photoCount < MIN_PHOTOS_FOR_VIRTUAL_TOUR) {
    return undefined;
  }
  return {
    angle: PropertyAdAngle.VIRTUAL_TOUR,
    strength: Math.min(90, 50 + listing.photoCount * 5),
    reasoning: `${String(listing.photoCount)} foto tersedia — cukup materi visual untuk walkthrough.`,
  };
}

/**
 * Scores every real `PropertyAdAngle` this listing's OWN data honestly supports, sorted strongest
 * first. `TESTIMONIAL` is never included (see this module's own header doc); every other angle is
 * included only when a real signal backs it — an empty array is a real, honest possible result
 * (e.g. a listing with no price, no description, and <5 photos).
 */
export function scorePropertyAdAngleStrength(
  listing: PropertyListingAngleSignals,
): readonly PropertyAngleStrength[] {
  const scored = [
    scoreDpRingan(listing),
    scoreReadyHuni(listing),
    scoreInvestasi(listing),
    scoreExclusive(listing),
    scoreSyariah(listing),
    scorePromoTerbatas(listing),
    scoreVirtualTour(listing),
  ].filter((s): s is PropertyAngleStrength => s !== undefined);

  return [...scored].sort((a, b) => b.strength - a.strength);
}
