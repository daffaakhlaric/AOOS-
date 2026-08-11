import type { InventoryUnit } from "@aos/dss-inventory-connector";

import type { FindForLeadCriteria } from "../contracts/IInventoryQuerier.js";

/**
 * Pure domain logic (no I/O) matching an already-fetched list of `InventoryUnit`s against a
 * lead's stated criteria (spec "UnitMatcher": "match: model + branch + price range", "partial
 * match: model only → return all that model"). `branch` is assumed already applied by the caller
 * (`InventoryQuerier` fetches per-branch before calling this) — `UnitMatcher` only ever filters on
 * `model` / `maxPrice` / `transmission`, so it stays reusable for both same-branch and
 * cross-branch (`InventoryQuerier.findAlternative`) matching.
 */
export class UnitMatcher {
  static match(
    units: ReadonlyArray<InventoryUnit>,
    criteria: Pick<FindForLeadCriteria, "model" | "maxPrice" | "transmission">,
  ): InventoryUnit[] {
    return units.filter((unit) => {
      if (criteria.model !== undefined) {
        const needle = criteria.model.trim().toLowerCase();
        if (needle.length > 0 && !unit.model.toString().toLowerCase().includes(needle)) {
          return false;
        }
      }
      if (criteria.maxPrice !== undefined && unit.price.toNumber() > criteria.maxPrice) {
        return false;
      }
      if (criteria.transmission !== undefined && unit.transmission !== criteria.transmission) {
        return false;
      }
      return true;
    });
  }
}
