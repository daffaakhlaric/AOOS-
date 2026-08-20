import type { PropertyListing } from "../domain/entities/PropertyListing.js";

/**
 * Pure domain logic (no I/O) matching an already-fetched list of `PropertyListing`s against a
 * lead's stated criteria — the PROPERTY-vertical sibling to `UnitMatcher`. Only ever filters on
 * `propertyType` / `maxPrice` / `minBedrooms` / `city`, so it stays reusable for both the primary
 * (all-criteria) match and `ListingQuerier.findAlternative`'s narrower cross-city fallback.
 */
export class ListingMatcher {
  static match(
    listings: ReadonlyArray<PropertyListing>,
    criteria: {
      readonly propertyType?: PropertyListing["propertyType"];
      readonly maxPrice?: number;
      readonly minBedrooms?: number;
      readonly city?: string;
    },
  ): PropertyListing[] {
    return listings.filter((listing) => {
      if (criteria.propertyType !== undefined && listing.propertyType !== criteria.propertyType) {
        return false;
      }
      if (criteria.maxPrice !== undefined && listing.price > criteria.maxPrice) {
        return false;
      }
      if (
        criteria.minBedrooms !== undefined &&
        (listing.bedrooms === undefined || listing.bedrooms < criteria.minBedrooms)
      ) {
        return false;
      }
      if (criteria.city !== undefined) {
        const needle = criteria.city.trim().toLowerCase();
        if (
          needle.length > 0 &&
          !(listing.city !== undefined && listing.city.toLowerCase().includes(needle))
        ) {
          return false;
        }
      }
      return true;
    });
  }
}
