import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";

/**
 * EYVRA — SAMANTHA V2 Phase 25 (PROMPT 33 — Listing Readiness). Pure, deterministic check of
 * whether a `ListingResponseDto` has what a new campaign needs — no I/O, same "pure domain
 * function over already-fetched real data" shape `assessFeasibility`/`assessCampaignHealth`
 * already establish.
 *
 * HONEST SCOPE: the raw spec (PROMPT 33) lists 12 checks — property type, price, location, listing
 * active, availability, usable photos, usable videos, legal info if required, KPR if claimed,
 * WhatsApp destination, brand, landing destination. This codebase's real `ListingResponseDto`
 * (`listing.dto.ts`) only carries real data for 6 of those:
 *   - propertyType / price — always real (Zod-enforced non-empty/positive at creation), checked
 *     anyway as a defense-in-depth sanity check, never assumed.
 *   - location — real, OPTIONAL `city`/`province`.
 *   - listingActive — real `listingStatus`, only `"AKTIF"` counts as ready-to-advertise (`DISEWAKAN`/
 *     `TERJUAL`/`DRAFT` are all real non-active states — conservative, not guessed).
 *   - usablePhotos — real `photos[]`.
 *   - whatsappDestination — real, OPTIONAL `waNumber`.
 * The remaining 6 (usable videos, legal info "if required", KPR "if claimed", brand, landing
 * destination beyond WhatsApp) have NO real backing field anywhere in `listing.dto.ts` — there is
 * no video field, no "legal required"/"KPR claimed" flag to condition on, no listing-level brand
 * field, no website/landing-page field. Per this session's "never invent listing fields" rule,
 * these are reported honestly via `skippedChecks`, never fabricated as pass or fail.
 */

export type ListingReadinessCheckName =
  "propertyType" | "price" | "location" | "listingActive" | "usablePhotos" | "whatsappDestination";

export const LISTING_READINESS_CHECK_NAMES: readonly ListingReadinessCheckName[] = [
  "propertyType",
  "price",
  "location",
  "listingActive",
  "usablePhotos",
  "whatsappDestination",
];

/** Spec-listed checks this codebase has genuinely no real data to evaluate — always the same list, never computed per-listing (there is nothing per-listing to compute from). */
export const LISTING_READINESS_SKIPPED_CHECKS: readonly string[] = [
  "usableVideos",
  "legalInfoIfRequired",
  "kprIfClaimed",
  "brand",
  "landingDestination",
];

export interface ListingReadinessCheck {
  readonly name: ListingReadinessCheckName;
  readonly passed: boolean;
  /** Indonesian, specific — `undefined` when `passed` is `true`. */
  readonly reason?: string;
}

export interface ListingReadinessResult {
  readonly listingId: string;
  readonly ready: boolean;
  readonly checks: readonly ListingReadinessCheck[];
  /** Same strings as each failing check's `reason`, flattened — mirrors the raw spec's `{ready, blockingIssues}` shape. */
  readonly blockingIssues: readonly string[];
  /** See this file's header doc — always `LISTING_READINESS_SKIPPED_CHECKS` today. */
  readonly skippedChecks: readonly string[];
}

function checkPropertyType(listing: ListingResponseDto): ListingReadinessCheck {
  if (listing.propertyType.length === 0) {
    return {
      name: "propertyType",
      passed: false,
      reason: "Tipe properti belum diisi.",
    };
  }
  return { name: "propertyType", passed: true };
}

function checkPrice(listing: ListingResponseDto): ListingReadinessCheck {
  if (!(listing.price > 0)) {
    return { name: "price", passed: false, reason: "Harga listing belum diisi dengan benar." };
  }
  return { name: "price", passed: true };
}

function checkLocation(listing: ListingResponseDto): ListingReadinessCheck {
  const hasLocation =
    (listing.city !== undefined && listing.city.length > 0) ||
    (listing.province !== undefined && listing.province.length > 0);
  if (!hasLocation) {
    return {
      name: "location",
      passed: false,
      reason: "Listing belum punya lokasi (kota/provinsi) — targeting geo tidak bisa dibangun.",
    };
  }
  return { name: "location", passed: true };
}

function checkListingActive(listing: ListingResponseDto): ListingReadinessCheck {
  if (listing.listingStatus !== "AKTIF") {
    return {
      name: "listingActive",
      passed: false,
      reason: `Status listing saat ini "${listing.listingStatus}" — hanya listing berstatus AKTIF yang bisa diiklankan.`,
    };
  }
  return { name: "listingActive", passed: true };
}

function checkUsablePhotos(listing: ListingResponseDto): ListingReadinessCheck {
  if (listing.photos.length === 0) {
    return {
      name: "usablePhotos",
      passed: false,
      reason: "Listing belum punya foto yang bisa dipakai untuk creative.",
    };
  }
  return { name: "usablePhotos", passed: true };
}

function checkWhatsappDestination(listing: ListingResponseDto): ListingReadinessCheck {
  if (listing.waNumber === undefined || listing.waNumber.length === 0) {
    return {
      name: "whatsappDestination",
      passed: false,
      reason: "Belum ada nomor WhatsApp destination pada listing ini.",
    };
  }
  return { name: "whatsappDestination", passed: true };
}

export function assessListingReadiness(listing: ListingResponseDto): ListingReadinessResult {
  const checks: readonly ListingReadinessCheck[] = [
    checkPropertyType(listing),
    checkPrice(listing),
    checkLocation(listing),
    checkListingActive(listing),
    checkUsablePhotos(listing),
    checkWhatsappDestination(listing),
  ];

  const blockingIssues = checks
    .filter((check) => !check.passed)
    .map((check) => check.reason)
    .filter((reason): reason is string => reason !== undefined);

  return {
    listingId: listing.id,
    ready: blockingIssues.length === 0,
    checks,
    blockingIssues,
    skippedChecks: LISTING_READINESS_SKIPPED_CHECKS,
  };
}
