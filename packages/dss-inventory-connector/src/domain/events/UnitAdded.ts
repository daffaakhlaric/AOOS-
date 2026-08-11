import type { Branch } from "@aos/meta-ads-connector";

import type { SourceSystem } from "../value-objects/SourceSystem.js";

/** Payload for `aaos.inventory.unit.added`, emitted the first time a unit's composite key is seen. */
export interface UnitAdded {
  readonly unitId: string;
  readonly brand: string;
  readonly model: string;
  readonly branch: Branch;
  readonly priceIDR: number;
  readonly sourceSystem: SourceSystem;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
