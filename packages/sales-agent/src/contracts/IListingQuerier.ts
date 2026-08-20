import type { Result } from "@aos/common";

import type { PropertyListing, PropertyType } from "../domain/entities/PropertyListing.js";
import type { AgentError } from "../domain/errors/AgentError.js";

export interface FindListingsCriteria {
  readonly propertyType?: PropertyType;
  readonly maxPrice?: number;
  readonly minBedrooms?: number;
  readonly city?: string;
}

/**
 * Port: queries Phase 2's real `listings` (via `IListingQueryService`) for units matching a lead's
 * stated criteria — the PROPERTY-vertical sibling to `IInventoryQuerier`. Same `Result<T, E>`
 * discipline: an empty match is still `ok([])`, only a real underlying query failure becomes
 * `err(...)`.
 */
export interface IListingQuerier {
  findForLead(criteria: FindListingsCriteria): Promise<Result<PropertyListing[], AgentError>>;

  /**
   * When no listing matches every criterion, look across ALL active listings for the same
   * propertyType/maxPrice/minBedrooms (dropping `city`) — the data behind "gak ada di area itu,
   * tapi ada yang mirip di [kota] lain" (mirrors `IInventoryQuerier.findAlternative`'s
   * cross-branch fallback).
   */
  findAlternative(criteria: Omit<FindListingsCriteria, "city">): PropertyListing[];
}
