import type { IListingQueryService, PropertyListing } from "@aos/sales-agent";

/**
 * The real `IListingQueryService` implementation this package composes for the PROPERTY vertical
 * (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8, spec section 12 point 3) — a small, genuinely
 * real in-memory adapter over already-fetched listing data (`SimulatorConfig.listings`), not a
 * mock: there is no in-process PROPERTY-vertical inventory-connector package the way
 * `@aos/dss-inventory-connector` exists for cars (confirmed via grep — none exists), and this
 * package never calls `apps/aaos-api` over HTTP directly (mirrors `InventoryConnectorFactory`'s
 * own in-process-only usage here). The caller (`apps/aaos-simulator`, the one process with a real
 * HTTP path to `apps/aaos-api`'s `ListingsController`) fetches the real listing rows and hands them
 * to `SimulatorConfig.listings`; this class serves exactly that data back out, unmodified.
 */
export class InMemoryListingQueryService implements IListingQueryService {
  constructor(private readonly listings: ReadonlyArray<PropertyListing>) {}

  getActive(): ReadonlyArray<PropertyListing> {
    return this.listings;
  }
}
