/**
 * Mirrors `apps/aaos-api`'s `modules/listings` DTOs exactly (AAOS-MULTI-TENANT-SUPERADMIN-
 * PROPERTY Phase 2, spec Part 4/9) — the wire contract between this app's `/api/listings/*` route
 * handlers and the real backend.
 */

export const PROPERTY_TYPES = ["RUMAH", "APARTEMEN", "RUKO", "TANAH", "VILLA"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const LISTING_STATUSES = ["AKTIF", "DISEWAKAN", "TERJUAL", "DRAFT"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export interface PhotoDto {
  readonly id: string;
  readonly url: string;
  readonly label?: string;
  readonly order: number;
  readonly isMain: boolean;
}

/** Mirrors `apps/aaos-api`'s `DocumentResponseDto` (Phase 2 — listing supporting documents: PDF/Excel/promo). */
export interface DocumentDto {
  readonly id: string;
  readonly filename: string;
  readonly url: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly label?: string;
  readonly uploadedAt: string;
}

export interface ListingDto {
  readonly id: string;
  readonly title: string;
  readonly propertyType: PropertyType;
  readonly listingStatus: ListingStatus;
  readonly price: number;
  readonly branchId?: string;
  readonly waNumber?: string;

  readonly landArea?: number;
  readonly buildArea?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly garage?: number;
  readonly floors?: number;
  readonly certificate?: string;
  readonly condition?: string;
  readonly electricity?: number;
  readonly facing?: string;

  readonly address?: string;
  readonly city?: string;
  readonly province?: string;
  readonly postalCode?: string;

  readonly description?: string;
  readonly highlights: readonly string[];

  readonly photos: readonly PhotoDto[];
  readonly mainPhotoUrl?: string;
  readonly documents: readonly DocumentDto[];
  readonly inKnowledgeBase: boolean;

  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListingListDto {
  readonly listings: readonly ListingDto[];
  readonly total: number;
}

export interface CreateListingInput {
  readonly title: string;
  readonly propertyType: PropertyType;
  readonly listingStatus?: ListingStatus;
  readonly price: number;
  readonly branchId?: string;
  readonly waNumber?: string;
  readonly landArea?: number;
  readonly buildArea?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly garage?: number;
  readonly floors?: number;
  readonly certificate?: string;
  readonly condition?: string;
  readonly electricity?: number;
  readonly facing?: string;
  readonly address?: string;
  readonly city?: string;
  readonly province?: string;
  readonly postalCode?: string;
  readonly description?: string;
  readonly highlights?: readonly string[];
}

export type UpdateListingInput = Partial<CreateListingInput>;

/** "Rp 1.8 Miliar" style formatting (Listing Manager grid card mockup, spec Part 4). */
export function formatListingPrice(price: number): string {
  if (price >= 1_000_000_000) {
    const miliar = price / 1_000_000_000;
    return `Rp ${trimTrailingZero(miliar)} Miliar`;
  }
  if (price >= 1_000_000) {
    const juta = price / 1_000_000;
    return `Rp ${trimTrailingZero(juta)} Juta`;
  }
  return `Rp ${price.toLocaleString("id-ID")}`;
}

function trimTrailingZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}
