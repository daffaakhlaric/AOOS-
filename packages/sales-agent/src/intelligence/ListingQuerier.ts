import { err, ErrorCode, ok, type Result } from "@aos/common";

import type { FindListingsCriteria } from "../contracts/IListingQuerier.js";
import type { IListingQueryService } from "../contracts/IListingQueryService.js";
import type { PropertyListing } from "../domain/entities/PropertyListing.js";
import { AgentError } from "../domain/errors/AgentError.js";

import { ListingMatcher } from "./ListingMatcher.js";

/**
 * Queries Phase 2's real `listings` (via `IListingQueryService`) for listings matching a lead's
 * criteria — the PROPERTY-vertical sibling to `InventoryQuerier`. Only ever surfaces listings the
 * real query service itself classifies as active (`getActive()` — mirrors `InventoryQuerier`'s own
 * reliance on `getAvailableByBranch` already excluding RESERVED/SOLD units).
 */
export class ListingQuerier {
  constructor(private readonly queryService: IListingQueryService) {}

  findForLead(criteria: FindListingsCriteria): Promise<Result<PropertyListing[], AgentError>> {
    try {
      const active = this.queryService.getActive();
      const matched = ListingMatcher.match(active, criteria);
      return Promise.resolve(ok(matched));
    } catch (cause) {
      return Promise.resolve(
        err(new AgentError(ErrorCode.INTERNAL, "ListingQuerier.findForLead failed", { cause })),
      );
    }
  }

  /**
   * When no listing matches every criterion (including `city`), look across ALL active listings
   * for the same propertyType/maxPrice/minBedrooms — the data behind "gak ada di area itu, tapi ada
   * yang mirip di [kota] lain" (mirrors `InventoryQuerier.findAlternative`).
   */
  findAlternative(criteria: Omit<FindListingsCriteria, "city">): PropertyListing[] {
    const active = this.queryService.getActive();
    return ListingMatcher.match(active, criteria);
  }
}
