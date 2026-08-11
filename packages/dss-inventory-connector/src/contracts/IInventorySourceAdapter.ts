import type { Result } from "@aos/common";
import type { Branch } from "@aos/meta-ads-connector";

import type { AdapterError } from "../domain/errors/index.js";
import type { SourcePriority } from "../domain/value-objects/SourcePriority.js";
import type { SourceSystem } from "../domain/value-objects/SourceSystem.js";

/** One unit as reported by a source, before normalization into the domain `InventoryUnit`. */
export interface RawInventoryUnit {
  readonly externalId: string;
  readonly brand: string;
  readonly model: string;
  readonly year: number;
  readonly transmission: "AT" | "MT";
  readonly color: string;
  readonly kilometer: number;
  readonly priceIDR: number;
  /** Raw string — normalized to `Branch` via `utils/BranchDetector.ts`. */
  readonly branch: string;
  /** Raw string — normalized to `UnitStatus` via `parseUnitStatus`. */
  readonly status: string;
  readonly photos?: ReadonlyArray<string>;
  readonly features?: ReadonlyArray<string>;
  readonly rawData?: Readonly<Record<string, unknown>>;
}

export interface AdapterHealth {
  readonly healthy: boolean;
  readonly latencyMs?: number;
  readonly message?: string;
}

/**
 * Port (Hexagonal Architecture / Adapter Pattern) — every data source (`MockInventoryAdapter`,
 * `GoogleSheetsAdapter`, `DmsAdapter`, `InventoryApiAdapter`, or any future custom adapter)
 * implements this interface. Domain and application code depend only on this contract, never on
 * a concrete adapter — that is the whole point of "interface-based" per the spec's Mission.
 */
export interface IInventorySourceAdapter {
  readonly sourceSystem: SourceSystem;
  readonly priority: SourcePriority;
  /** `undefined` when this adapter/instance covers all branches. */
  readonly branch?: Branch;

  isConfigured(): boolean;

  fetchUnits(): Promise<Result<RawInventoryUnit[], AdapterError>>;

  fetchUnitsByBranch(branch: Branch): Promise<Result<RawInventoryUnit[], AdapterError>>;

  healthCheck(): Promise<Result<AdapterHealth, AdapterError>>;
}
