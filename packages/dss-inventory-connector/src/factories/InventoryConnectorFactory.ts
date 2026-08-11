import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { ConflictResolutionService } from "../application/services/ConflictResolutionService.js";
import { InventoryQueryService } from "../application/services/InventoryQueryService.js";
import { InventorySyncService } from "../application/services/InventorySyncService.js";
import type { Tracer } from "../application/tracer.js";
import { DetectChanges } from "../application/use-cases/DetectChanges.js";
import { GetAvailableUnits } from "../application/use-cases/GetAvailableUnits.js";
import { GetUnit } from "../application/use-cases/GetUnit.js";
import { GetUnitsByBranch } from "../application/use-cases/GetUnitsByBranch.js";
import { GetUnitsByModel } from "../application/use-cases/GetUnitsByModel.js";
import { GetUnitsByPriceRange } from "../application/use-cases/GetUnitsByPriceRange.js";
import { QueryInventory } from "../application/use-cases/QueryInventory.js";
import { SyncFromSource } from "../application/use-cases/SyncFromSource.js";
import { SyncInventory } from "../application/use-cases/SyncInventory.js";
import type { InventoryConnectorConfig } from "../config/InventoryConnectorConfig.js";
import { DssInventoryConnectorEvents } from "../domain/events/DssInventoryConnectorEvents.js";
import { DmsAdapter } from "../infrastructure/adapters/DmsAdapter.js";
import { GoogleSheetsAdapter } from "../infrastructure/adapters/GoogleSheetsAdapter.js";
import { InventoryApiAdapter } from "../infrastructure/adapters/InventoryApiAdapter.js";
import { MockInventoryAdapter } from "../infrastructure/adapters/MockInventoryAdapter.js";
import { InventorySourceRegistry } from "../infrastructure/registry/InventorySourceRegistry.js";
import { InMemoryInventoryStore } from "../infrastructure/store/InMemoryInventoryStore.js";

export interface InventoryConnectorFactoryOptions {
  readonly config: InventoryConnectorConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, the same composition-boundary discipline `@aos/whatsapp-connector`'s factory establishes. */
  readonly publisher: IPublisher;
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable clock — defaults to the real wall clock only here. */
  readonly now?: () => Date;
}

export interface InventoryConnector {
  readonly syncInventory: SyncInventory;
  readonly syncFromSource: SyncFromSource;
  readonly queryInventory: QueryInventory;
  readonly getUnit: GetUnit;
  readonly getAvailableUnits: GetAvailableUnits;
  readonly getUnitsByBranch: GetUnitsByBranch;
  readonly getUnitsByModel: GetUnitsByModel;
  readonly getUnitsByPriceRange: GetUnitsByPriceRange;
  readonly detectChanges: DetectChanges;
  readonly syncService: InventorySyncService;
  readonly queryService: InventoryQueryService;
  readonly store: InMemoryInventoryStore;
  readonly registry: InventorySourceRegistry;
}

/**
 * The composition root (Factory Pattern) — wires every real `@aos/*` integration and every
 * infrastructure adapter into the use cases + services this package's public API exposes.
 * Registers all 4 adapters (`MockInventoryAdapter` always; the 3 shells always registered too, so
 * `InventorySyncService`'s `isConfigured()` gating — not adapter *presence* — is what decides
 * whether a shell participates in a given sync).
 */
export class InventoryConnectorFactory {
  static create(options: InventoryConnectorFactoryOptions): InventoryConnector {
    const logger = options.logger ?? createLogger({ serviceName: "dss-inventory-connector" });
    const tracer: Tracer = options.tracer ?? getTracer("dss-inventory-connector");
    const now = options.now ?? (() => new Date());

    const store = new InMemoryInventoryStore();
    const registry = new InventorySourceRegistry();
    registry.register(new MockInventoryAdapter());
    registry.register(new GoogleSheetsAdapter(options.config));
    registry.register(new DmsAdapter(options.config));
    registry.register(new InventoryApiAdapter(options.config));

    const resolver = new ConflictResolutionService(logger, now);
    const events = new DssInventoryConnectorEvents(options.publisher);
    const queryService = new InventoryQueryService(store);
    const syncService = new InventorySyncService(
      registry,
      store,
      resolver,
      events,
      logger,
      options.config,
      now,
    );

    return {
      syncInventory: new SyncInventory(syncService, tracer),
      syncFromSource: new SyncFromSource(syncService, tracer),
      queryInventory: new QueryInventory(queryService),
      getUnit: new GetUnit(queryService),
      getAvailableUnits: new GetAvailableUnits(queryService),
      getUnitsByBranch: new GetUnitsByBranch(queryService),
      getUnitsByModel: new GetUnitsByModel(queryService),
      getUnitsByPriceRange: new GetUnitsByPriceRange(queryService),
      detectChanges: new DetectChanges(),
      syncService,
      queryService,
      store,
      registry,
    };
  }
}
