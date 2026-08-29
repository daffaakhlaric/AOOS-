import type { Branch } from "@aos/meta-ads-connector";

/** Payload for `aaos.inventory.unit.sold` — consumed by Samantha to auto-pause campaigns advertising this unit. */
export interface UnitSold {
  readonly unitId: string;
  readonly brand: string;
  readonly model: string;
  readonly branch: Branch;
  readonly priceIDR: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
