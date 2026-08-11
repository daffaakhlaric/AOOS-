import type { InventoryUnit } from "@aos/dss-inventory-connector";

import { formatPrice } from "./formatters.js";
import { pickFromPool } from "./PoolSelector.js";

/** DP/cicilan response pool (spec "Response Templates" — `DP_INFO(unit)`), using the unit's real `estimatedDp`/`estimatedMonthly`. */
export function dpInfoPool(unit: InventoryUnit): ReadonlyArray<string> {
  return [
    `DP-nya mulai Rp ${formatPrice(unit.estimatedDp.toNumber())} kak, cicilan sekitar Rp ${formatPrice(unit.estimatedMonthly.toNumber())}/bulan (48 bulan) 😊\nMau Jessy hitung simulasi lengkapnya?`,
  ];
}

export function getDpInfoResponse(unit: InventoryUnit, seed: number): string {
  return pickFromPool(dpInfoPool(unit), seed);
}
