import type { IListingQueryService, PropertyListing } from "@aos/sales-agent";

/**
 * Instrumented decorator around a real `IListingQueryService` (AAOS-MULTI-TENANT-SUPERADMIN-
 * PROPERTY Phase 8, spec section 12 point 3) — the PROPERTY-vertical sibling to
 * `InventoryQueryServiceSpy`, same observation-seam shape. `@aos/sales-agent`'s exported event
 * list has no dedicated "listing queried" event, so `claraUsedInventory`-style tracking for the
 * PROPERTY vertical can't be derived from event-bus listening alone — this spy wraps the exact
 * seam `ClaraAgentFactory.createPropertyAgent` injects (`options.listingQueryService`), and
 * records whether `getActive()` — the only method `@aos/sales-agent`'s own `ListingQuerier` calls —
 * was ever invoked with a non-empty result during the session. Delegates to the real service;
 * never mocks or reimplements query logic itself.
 */
export class ListingQueryServiceSpy implements IListingQueryService {
  private usedNonEmpty = false;

  constructor(private readonly real: IListingQueryService) {}

  /** `true` once `getActive()` has returned at least one listing during this session. */
  get wasUsedWithResult(): boolean {
    return this.usedNonEmpty;
  }

  getActive(): ReadonlyArray<PropertyListing> {
    const result = this.real.getActive();
    if (result.length > 0) {
      this.usedNonEmpty = true;
    }
    return result;
  }
}
