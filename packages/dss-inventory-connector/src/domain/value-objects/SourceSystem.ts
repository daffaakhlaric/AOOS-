/**
 * Which data source an `InventoryUnit`/`RawInventoryUnit` came from.
 *
 * Judgment call (documented in the engineering report's resolution #2): this file is not listed
 * in the spec's literal `domain/value-objects/` folder tree, but `InventoryUnit.sourceSystem`,
 * every `IInventorySourceAdapter.sourceSystem`, several events, and the spec's own Public API
 * section (`export { SourceSystem } from "./domain/value-objects/SourceSystem.js"`) all require
 * it to exist — treated as a listing omission, not an intentional exclusion, and built as a real
 * enum here.
 */
export enum SourceSystem {
  GOOGLE_SHEETS = "GOOGLE_SHEETS",
  DMS = "DMS",
  API = "API",
  MOCK = "MOCK",
}
