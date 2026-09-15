import type { ListingDto } from "@/types/listing.types";

/**
 * Kai Creative Engine Sprint 1 (indicator) — client-side port of `@aos/creative-agent`'s
 * `scorePropertyAdAngleStrength`. Deliberately duplicated here rather than imported: this package
 * is a `apps/aaos-api`-facing Node package, and this dashboard already establishes the "duplicate a
 * small, pure vocabulary/logic slice client-side rather than pull a backend package into the browser
 * bundle" convention (`PropertyManualBriefForm.tsx`'s own local `PROPERTY_AD_ANGLES` array is the
 * same call for the enum itself). Kept logic-for-logic identical to the real backend scorer
 * (`packages/creative-agent/src/intelligence/PropertyAngleStrengthScorer.ts`) so the badge shown
 * here never disagrees with the real reasoning threaded into the actual Kie AI prompt server-side —
 * if that file's thresholds change, this one should change with it.
 *
 * Same honest-degrade discipline as the backend original: `TESTIMONIAL` is never scored (no
 * per-listing review data exists anywhere in this codebase), and an angle with no real signal is
 * simply absent from the result — never a fabricated strength.
 */

export interface AngleStrengthHint {
  readonly angle: string;
  readonly strength: number;
  readonly reasoning: string;
}

const READY_HUNI_KEYWORDS = ["siap huni", "ready", "baru", "renovasi total"];
const SYARIAH_KEYWORDS = ["syariah", "syari'ah", "shariah"];
const PROMO_KEYWORDS = ["promo", "terbatas", "limited", "diskon", "cashback"];
const INVESTASI_KEYWORDS = ["investasi", "investment", "capital gain"];
const INVESTABLE_PROPERTY_TYPES = ["TANAH", "RUKO", "APARTEMEN"];
const MIN_PHOTOS_FOR_VIRTUAL_TOUR = 5;

function containsAny(haystack: string | undefined, needles: readonly string[]): boolean {
  if (haystack === undefined) {
    return false;
  }
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function scoreDpRingan(listing: ListingDto): AngleStrengthHint | undefined {
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
    angle: "DP_RINGAN",
    strength,
    reasoning: `Harga Rp${listing.price.toLocaleString("id-ID")} — semakin terjangkau, semakin kuat angle DP ringan.`,
  };
}

function scoreReadyHuni(listing: ListingDto): AngleStrengthHint | undefined {
  if (
    !containsAny(listing.condition, READY_HUNI_KEYWORDS) &&
    !containsAny(listing.description, READY_HUNI_KEYWORDS)
  ) {
    return undefined;
  }
  return {
    angle: "READY_HUNI",
    strength: 80,
    reasoning: "Kondisi/deskripsi listing menyebutkan siap huni.",
  };
}

function scoreInvestasi(listing: ListingDto): AngleStrengthHint | undefined {
  const typeMatch = INVESTABLE_PROPERTY_TYPES.includes(listing.propertyType.toUpperCase());
  const textMatch = containsAny(listing.description, INVESTASI_KEYWORDS);
  if (!typeMatch && !textMatch) {
    return undefined;
  }
  return {
    angle: "INVESTASI",
    strength: typeMatch ? 75 : 60,
    reasoning: typeMatch
      ? `Tipe properti ${listing.propertyType} secara umum lebih investable.`
      : "Deskripsi listing menyebutkan nilai investasi.",
  };
}

function scoreExclusive(listing: ListingDto): AngleStrengthHint | undefined {
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
    angle: "EXCLUSIVE",
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

function scoreSyariah(listing: ListingDto): AngleStrengthHint | undefined {
  if (
    !containsAny(listing.description, SYARIAH_KEYWORDS) &&
    !containsAny(listing.certificate, SYARIAH_KEYWORDS)
  ) {
    return undefined;
  }
  return {
    angle: "SYARIAH",
    strength: 80,
    reasoning: "Listing secara eksplisit menyebutkan skema syariah.",
  };
}

function scorePromoTerbatas(listing: ListingDto): AngleStrengthHint | undefined {
  if (!containsAny(listing.description, PROMO_KEYWORDS)) {
    return undefined;
  }
  return {
    angle: "PROMO_TERBATAS",
    strength: 85,
    reasoning: "Deskripsi listing menyebutkan promo/unit terbatas.",
  };
}

function scoreVirtualTour(listing: ListingDto): AngleStrengthHint | undefined {
  const photoCount = listing.photos.length;
  if (photoCount < MIN_PHOTOS_FOR_VIRTUAL_TOUR) {
    return undefined;
  }
  return {
    angle: "VIRTUAL_TOUR",
    strength: Math.min(90, 50 + photoCount * 5),
    reasoning: `${String(photoCount)} foto tersedia — cukup materi visual untuk walkthrough.`,
  };
}

/** Scores every real `PropertyAdAngle` this listing's OWN data honestly supports, sorted strongest first. Never includes `TESTIMONIAL`. */
export function scoreListingAngleStrength(listing: ListingDto): readonly AngleStrengthHint[] {
  const scored = [
    scoreDpRingan(listing),
    scoreReadyHuni(listing),
    scoreInvestasi(listing),
    scoreExclusive(listing),
    scoreSyariah(listing),
    scorePromoTerbatas(listing),
    scoreVirtualTour(listing),
  ].filter((s): s is AngleStrengthHint => s !== undefined);

  return [...scored].sort((a, b) => b.strength - a.strength);
}
