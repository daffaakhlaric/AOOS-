import type { Branch } from "@aos/meta-ads-connector";

import type { RawInventoryUnit } from "../contracts/IInventorySourceAdapter.js";
import type { InventoryUnit } from "../domain/entities/InventoryUnit.js";
import type { SourceSystem } from "../domain/value-objects/SourceSystem.js";
import type { UnitStatus } from "../domain/value-objects/UnitStatus.js";

/**
 * A `RawInventoryUnit` tagged with the `SourceSystem` it came from.
 *
 * Judgment call: `RawInventoryUnit` (per the spec's own `IInventorySourceAdapter` interface) has
 * no `sourceSystem` field — a single adapter's `fetchUnits()` result is implicitly "from that
 * adapter". `ConflictResolutionService.resolve()` needs to compare units *across* adapters
 * though, so `InventorySyncService` tags each adapter's raw results with its `sourceSystem`
 * before handing the combined pool to `resolve()`.
 */
export interface SourceTaggedRawUnit extends RawInventoryUnit {
  readonly sourceSystem: SourceSystem;
}

/** `InventoryQueryService.getByCriteria` filter — every field is optional and AND-combined. */
export interface InventoryQueryCriteria {
  readonly branch?: Branch;
  readonly model?: string;
  readonly brand?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly maxKilometer?: number;
  readonly transmission?: "AT" | "MT";
  readonly status?: UnitStatus;
}

/** One field-level change between a previously-stored unit and its just-resolved replacement. */
export interface UnitChange {
  readonly previous: InventoryUnit;
  readonly current: InventoryUnit;
}

/** The result of diffing two `InventorySnapshot`s — `DetectChanges`' output. */
export interface InventoryChangeSet {
  readonly added: ReadonlyArray<InventoryUnit>;
  readonly updated: ReadonlyArray<UnitChange>;
  readonly sold: ReadonlyArray<InventoryUnit>;
  readonly removed: ReadonlyArray<InventoryUnit>;
}
