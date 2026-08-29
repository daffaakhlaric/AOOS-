import type { Result } from "@aos/common";
import type {
  IInventoryQueryService,
  InventoryQueryCriteria,
  InventoryUnit,
  UnitId,
  UnitNotFoundError,
  UnitPrice,
} from "@aos/dss-inventory-connector";
import type { Branch } from "@aos/meta-ads-connector";

/**
 * Instrumented decorator around `@aos/dss-inventory-connector`'s real `IInventoryQueryService`
 * (design resolution #4). `@aos/sales-agent`'s exported event list has no dedicated "inventory
 * queried" event, so `claraUsedInventory` can't be derived from event-bus listening alone — this
 * spy wraps the exact seam `ClaraAgentFactory` injects (`options.inventoryQueryService`), and
 * records whether `getAvailableByBranch`/`getAvailable` — the 2 methods `@aos/sales-agent`'s own
 * `InventoryQuerier.findForLead`/`findAlternative` call — were ever invoked with a non-empty
 * result during the session. Delegates every method to the real, fully-synced service; never
 * mocks or reimplements query logic itself.
 */
export class InventoryQueryServiceSpy implements IInventoryQueryService {
  private usedNonEmpty = false;

  constructor(private readonly real: IInventoryQueryService) {}

  /** `true` once `getAvailableByBranch`/`getAvailable` has returned at least one unit during this session. */
  get wasUsedWithResult(): boolean {
    return this.usedNonEmpty;
  }

  getAll(): ReadonlyArray<InventoryUnit> {
    return this.real.getAll();
  }

  getById(id: UnitId): Result<InventoryUnit, UnitNotFoundError> {
    return this.real.getById(id);
  }

  getByBranch(branch: Branch): ReadonlyArray<InventoryUnit> {
    return this.real.getByBranch(branch);
  }

  getByModel(model: string): ReadonlyArray<InventoryUnit> {
    return this.real.getByModel(model);
  }

  getByBrand(brand: string): ReadonlyArray<InventoryUnit> {
    return this.real.getByBrand(brand);
  }

  getAvailable(): ReadonlyArray<InventoryUnit> {
    const result = this.real.getAvailable();
    if (result.length > 0) {
      this.usedNonEmpty = true;
    }
    return result;
  }

  getAvailableByBranch(branch: Branch): ReadonlyArray<InventoryUnit> {
    const result = this.real.getAvailableByBranch(branch);
    if (result.length > 0) {
      this.usedNonEmpty = true;
    }
    return result;
  }

  getByPriceRange(min: number, max: number): ReadonlyArray<InventoryUnit> {
    return this.real.getByPriceRange(min, max);
  }

  getByCriteria(criteria: InventoryQueryCriteria): ReadonlyArray<InventoryUnit> {
    return this.real.getByCriteria(criteria);
  }

  countByBranch(): Record<Branch, number> {
    return this.real.countByBranch();
  }

  countByModel(): Record<string, number> {
    return this.real.countByModel();
  }

  getLowestPriceByModel(model: string): UnitPrice | undefined {
    return this.real.getLowestPriceByModel(model);
  }

  getTotalInventoryValue(): UnitPrice {
    return this.real.getTotalInventoryValue();
  }
}
