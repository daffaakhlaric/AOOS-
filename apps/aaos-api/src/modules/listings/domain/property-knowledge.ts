import type { ListingResponseDto } from "../dto/listing.dto.js";

/**
 * Spec Part 6's `PropertyKnowledge` interface — Jessy's real knowledge base for the PROPERTY
 * vertical. Automotive's Jessy knowledge is scraper-derived (`scraped_units`); PROPERTY has no
 * scraper (spec's `OVERVIEW` — "Scraper: TIDAK ADA → replaced by Listing Manager"), so this is
 * built from `listings` rows explicitly marked `in_knowledge_base = true` via
 * `POST /api/v1/listings/:id/publish-knowledge`, not every listing unconditionally.
 */
export interface PropertyKnowledgeListing {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly price: number;
  readonly priceFormatted: string;
  readonly specs: {
    readonly landArea?: number;
    readonly buildArea?: number;
    readonly bedrooms?: number;
    readonly bathrooms?: number;
    readonly garage?: number;
    readonly certificate?: string;
  };
  readonly location?: string;
  readonly highlights: readonly string[];
  readonly waNumber?: string;
  readonly photos: readonly string[];
}

export interface PropertyKnowledge {
  readonly listings: readonly PropertyKnowledgeListing[];
}

/** "Rp 1.8 Miliar" style formatting per the Listing Manager grid card mockup (spec Part 4). */
export function formatIdrPrice(price: number): string {
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

function locationOf(listing: ListingResponseDto): string | undefined {
  const parts = [listing.city, listing.province].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : listing.branchId;
}

/** Maps one `ListingResponseDto` into its `PropertyKnowledge` entry shape. */
export function toPropertyKnowledgeListing(listing: ListingResponseDto): PropertyKnowledgeListing {
  return {
    id: listing.id,
    title: listing.title,
    type: listing.propertyType,
    status: listing.listingStatus,
    price: listing.price,
    priceFormatted: formatIdrPrice(listing.price),
    specs: {
      ...(listing.landArea !== undefined ? { landArea: listing.landArea } : {}),
      ...(listing.buildArea !== undefined ? { buildArea: listing.buildArea } : {}),
      ...(listing.bedrooms !== undefined ? { bedrooms: listing.bedrooms } : {}),
      ...(listing.bathrooms !== undefined ? { bathrooms: listing.bathrooms } : {}),
      ...(listing.garage !== undefined ? { garage: listing.garage } : {}),
      ...(listing.certificate !== undefined ? { certificate: listing.certificate } : {}),
    },
    ...(locationOf(listing) !== undefined ? { location: locationOf(listing) } : {}),
    highlights: listing.highlights,
    ...(listing.waNumber !== undefined ? { waNumber: listing.waNumber } : {}),
    photos: listing.photos.map((photo) => photo.url),
  };
}

/** Builds the full `PropertyKnowledge` aggregate from every `in_knowledge_base` listing of a tenant. */
export function buildPropertyKnowledge(listings: readonly ListingResponseDto[]): PropertyKnowledge {
  return { listings: listings.filter((l) => l.inKnowledgeBase).map(toPropertyKnowledgeListing) };
}
