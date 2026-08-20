import type { PropertyListing } from "../domain/entities/PropertyListing.js";

/**
 * Port for real, tenant-scoped read access over Phase 2's real `listings` table (spec section 11
 * point 1) — the PROPERTY-vertical sibling to `@aos/dss-inventory-connector`'s
 * `IInventoryQueryService`. Deliberately narrower: tenant/status scoping ("AKTIF only") is assumed
 * already applied by whoever composes the real implementation (mirrors `InventoryQuerier`'s own
 * per-branch-scoped-upstream discipline) — this port only exposes what `ListingQuerier` needs to
 * narrow further by the lead's stated criteria. The only real implementation lives outside this
 * package (`apps/aaos-api`/`apps/aaos-simulator`, adapting the real `ListingsService`); tests use a
 * plain in-memory fake, the same way `ConversationEngine.spec.ts` fakes `IInventoryQueryService`.
 */
export interface IListingQueryService {
  /** Every active (`listingStatus === "AKTIF"`) listing for the composed tenant. */
  getActive(): ReadonlyArray<PropertyListing>;
}
