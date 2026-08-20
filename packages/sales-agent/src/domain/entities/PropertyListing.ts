/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 7 — Jessy's PROPERTY-vertical sibling to
 * `@aos/dss-inventory-connector`'s `InventoryUnit`. Deliberately a plain readonly shape (not a
 * value-object class like `InventoryUnit`) — `packages/sales-agent` has no dependency on
 * `apps/aaos-api`'s Nest-only `ListingsService`/`ListingResponseDto`, so this is this package's own
 * minimal projection of a Phase 2 `listings` row, carrying only the fields Jessy's conversation
 * layer (`ListingQuerier`/`PropertyResponseGenerator`) actually needs. The real production adapter
 * that implements `IListingQueryService` (composed in `apps/aaos-api`/`apps/aaos-simulator`, outside
 * this package) is responsible for mapping the real `ListingResponseDto` into this shape.
 */
export const PROPERTY_TYPES = ["RUMAH", "APARTEMEN", "RUKO", "TANAH", "VILLA"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export interface PropertyListing {
  readonly id: string;
  readonly title: string;
  readonly propertyType: PropertyType;
  /** Whole-rupiah asking price. */
  readonly price: number;
  readonly city?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly landArea?: number;
  readonly buildArea?: number;
  readonly waNumber?: string;
  readonly mainPhotoUrl?: string;
}
