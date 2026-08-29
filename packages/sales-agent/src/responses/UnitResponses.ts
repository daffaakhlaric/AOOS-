import type { InventoryUnit } from "@aos/dss-inventory-connector";

import { formatKm, formatPrice } from "./formatters.js";
import { pickFromPool } from "./PoolSelector.js";

/** Unit-found response pool (spec "Response Templates" — `UNIT_FOUND(unit)`). */
export function unitFoundPool(unit: InventoryUnit): ReadonlyArray<string> {
  return [
    `Ada kak! ${unit.brand.toString()} ${unit.model.toString()} ${unit.year.toNumber()}, km ${formatKm(unit.kilometer.toNumber())}, kondisi bagus 👍\nHarga Rp ${formatPrice(unit.price.toNumber())}. Mau Clara kirimin detail fotonya?`,
    `Kebetulan ada nih kak! ${unit.displayName}, harga Rp ${formatPrice(unit.price.toNumber())}, km masih ${formatKm(unit.kilometer.toNumber())} 😊\nMau tau cicilan per bulannya?`,
  ];
}

export function getUnitFoundResponse(unit: InventoryUnit, seed: number): string {
  return pickFromPool(unitFoundPool(unit), seed);
}

/** Unit-not-found response, optionally naming an alternative branch that DOES have a match (spec "Not found → suggest nearest branch"). */
export function getUnitNotFoundResponse(
  model: string,
  branchName: string,
  alternativeBranchName?: string,
): string {
  if (alternativeBranchName !== undefined) {
    return `Stok ${model} di ${branchName} lagi kosong kak, tapi di ${alternativeBranchName} ada nih yang bagus 😊 mau Clara cek?`;
  }
  return `Waduh, stok ${model} di ${branchName} lagi kosong kak 😊 Mau Clara cariin unit lain yang mirip?`;
}
