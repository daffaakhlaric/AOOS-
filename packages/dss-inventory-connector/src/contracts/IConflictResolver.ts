import type { InventoryUnit } from "../domain/entities/InventoryUnit.js";
import type { SourceTaggedRawUnit } from "../types/InventoryTypes.js";

/**
 * Port (Strategy Pattern) for the conflict resolution strategy. The only implementation is
 * `application/services/ConflictResolutionService.ts`.
 *
 * `resolve` reconciles *within one sync pass*: given every source's raw units (tagged with which
 * source they came from), group by composite key and keep only the highest-`SourcePriority`
 * raw unit per group, built into a fresh `InventoryUnit`.
 *
 * `merge` reconciles *across sync passes*: given a previously-stored `InventoryUnit` and this
 * pass's resolved winner for the same composite key, decide (again by `SourcePriority`) whether
 * the winner replaces the stored unit's content — preserving the stored unit's `id`/`createdAt`
 * either way, so identity survives across syncs even when content changes.
 */
export interface IConflictResolver {
  resolve(units: ReadonlyArray<SourceTaggedRawUnit>): InventoryUnit[];
  merge(existing: InventoryUnit, incoming: InventoryUnit): InventoryUnit;
  /** The `brand|model|year|transmission|branch` match key used to correlate units across sources/sync passes — exposed so `InventorySyncService` can correlate `resolve()`'s winners against the current store contents. */
  compositeKeyOf(unit: InventoryUnit): string;
}
