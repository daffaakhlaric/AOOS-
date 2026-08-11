import type { IInventorySourceAdapter } from "../../contracts/IInventorySourceAdapter.js";
import type { SourceSystem } from "../../domain/value-objects/SourceSystem.js";

/** `Map<SourceSystem, IInventorySourceAdapter>` (Registry Pattern) — the single place `InventorySyncService` looks up which adapter serves which source. */
export class InventorySourceRegistry {
  private readonly bySource = new Map<SourceSystem, IInventorySourceAdapter>();

  register(adapter: IInventorySourceAdapter): void {
    this.bySource.set(adapter.sourceSystem, adapter);
  }

  get(source: SourceSystem): IInventorySourceAdapter | undefined {
    return this.bySource.get(source);
  }

  listAll(): ReadonlyArray<IInventorySourceAdapter> {
    return [...this.bySource.values()];
  }
}
