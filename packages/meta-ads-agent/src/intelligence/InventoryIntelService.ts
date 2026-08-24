import type { InventoryUnit } from "@aos/dss-inventory-connector";

import { AdAngle } from "../domain/value-objects/AdAngle.js";

/**
 * AAOS-TAMARA-INTELLIGENCE-LAYER Phase 1 ("Source 5: Inventory / Listing Data"). Pure —
 * receives already-fetched domain entities (never queries Supabase / the inventory connector
 * itself), matching `BudgetOptimizer`/`CampaignHealthAnalyzer`'s existing style of interpreting
 * already-fetched data rather than doing I/O.
 *
 * AUTOMOTIVE reads `@aos/dss-inventory-connector`'s real `InventoryUnit` (see
 * `packages/dss-inventory-connector/src/domain/entities/InventoryUnit.ts`). Two spec fields do
 * NOT exist on the real entity and are recomputed honestly instead:
 * - `u.stockCount` doesn't exist — `InventoryUnit` is ONE physical unit, not a per-model stock
 *   count. "Low stock" here means: fewer than `lowStockThreshold` units of the SAME `model`
 *   remain `AVAILABLE` (the caller passes already-`getAvailableByBranch`-filtered units — see
 *   `packages/sales-agent/src/intelligence/InventoryQuerier.ts` for the established
 *   `IInventoryQueryService.getAvailableByBranch` read pattern this mirrors).
 * - `u.daysSinceAdded` doesn't exist — the real, equivalent field is `InventoryUnit.ageInDays`.
 * - `u.hasCampaign` doesn't exist anywhere in `@aos/dss-inventory-connector` (no campaign
 *   association on this entity at all) — the spec's `slowMoving` ("units 30+ days old with no
 *   campaign") is UNCOMPUTABLE from this data source alone and is narrowed to "units 30+ days
 *   old, still available" without the campaign check, documented on `slowMovingUnits` below.
 *
 * PROPERTY reads a locally-defined `PropertyListingSnapshot` (NOT `apps/aaos-api`'s
 * `ListingResponseDto` — a package must never depend on an app) shaped after the real
 * `listings` table (`apps/aaos-api/supabase/migrations/008_listings.sql`) as read through
 * `ListingsService`/`ListingRow`. The spec's `l.is_featured` column does NOT exist on the real
 * `listings` table (only `title, listing_status, created_at`, among others — no featured flag
 * anywhere in the migration or `ListingRow`) — `featuredListings` is dropped entirely rather than
 * fabricated against a nonexistent column.
 */
export interface PropertyListingSnapshot {
  readonly id: string;
  readonly title: string;
  readonly listingStatus: string;
  readonly createdAt: Date;
}

export interface AutomotiveInventorySignal {
  readonly hasLowStock: boolean;
  /** Model names (e.g. "Xpander Cross") with fewer than `lowStockThreshold` `AVAILABLE` units. */
  readonly lowStockModels: ReadonlyArray<string>;
  readonly hasNewArrivals: boolean;
  readonly newArrivalUnits: ReadonlyArray<string>;
  /** Units `>= slowMovingDays` old — no campaign-association check possible, see file docstring. */
  readonly slowMovingUnits: ReadonlyArray<string>;
  readonly recommendedAngle: AdAngle;
}

export interface PropertyInventorySignal {
  readonly totalActive: number;
  readonly newListings: ReadonlyArray<string>;
  readonly recommendedAngle: string;
}

const DEFAULT_LOW_STOCK_THRESHOLD = 2;
const DEFAULT_NEW_ARRIVAL_DAYS = 7;
const DEFAULT_SLOW_MOVING_DAYS = 30;

export class InventoryIntelService {
  /**
   * `units` should already be scoped to one branch's `AVAILABLE` units (the caller's
   * responsibility — e.g. `IInventoryQueryService.getAvailableByBranch(branch)`), matching
   * `InventoryQuerier`'s established read pattern.
   */
  static automotiveSignals(
    units: ReadonlyArray<InventoryUnit>,
    lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD,
    newArrivalDays = DEFAULT_NEW_ARRIVAL_DAYS,
    slowMovingDays = DEFAULT_SLOW_MOVING_DAYS,
  ): AutomotiveInventorySignal {
    const countByModel = new Map<string, number>();
    for (const unit of units) {
      const key = unit.model.toString();
      countByModel.set(key, (countByModel.get(key) ?? 0) + 1);
    }
    const lowStockModels = [...countByModel.entries()]
      .filter(([, count]) => count <= lowStockThreshold)
      .map(([model]) => model);

    const newArrivals = units.filter((unit) => unit.ageInDays <= newArrivalDays);
    const slowMoving = units.filter((unit) => unit.ageInDays >= slowMovingDays);

    const recommendedAngle =
      lowStockModels.length > 0
        ? AdAngle.GUDANGNYA
        : newArrivals.length > 0
          ? AdAngle.DISCOVERY
          : AdAngle.DP_RINGAN;

    return {
      hasLowStock: lowStockModels.length > 0,
      lowStockModels,
      hasNewArrivals: newArrivals.length > 0,
      newArrivalUnits: newArrivals.map((unit) => unit.displayName),
      slowMovingUnits: slowMoving.map((unit) => unit.displayName),
      recommendedAngle,
    };
  }

  static propertySignals(
    listings: ReadonlyArray<PropertyListingSnapshot>,
    activeStatus = "AKTIF",
    newListingDays = DEFAULT_NEW_ARRIVAL_DAYS,
    referenceDate: Date = new Date(),
  ): PropertyInventorySignal {
    const active = listings.filter((listing) => listing.listingStatus === activeStatus);
    const newListings = active.filter((listing) => {
      const ageMs = referenceDate.getTime() - listing.createdAt.getTime();
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      return ageDays >= 0 && ageDays <= newListingDays;
    });

    return {
      totalActive: active.length,
      newListings: newListings.map((listing) => listing.title),
      recommendedAngle: newListings.length > 0 ? "READY_HUNI" : "DP_RINGAN",
    };
  }
}
