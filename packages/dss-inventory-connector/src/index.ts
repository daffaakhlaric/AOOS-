// Factory
export {
  InventoryConnectorFactory,
  type InventoryConnector,
  type InventoryConnectorFactoryOptions,
} from "./factories/InventoryConnectorFactory.js";

// Use Cases
export { SyncInventory, type SyncInventoryInput } from "./application/use-cases/SyncInventory.js";
export {
  SyncFromSource,
  type SyncFromSourceInput,
} from "./application/use-cases/SyncFromSource.js";
export { QueryInventory } from "./application/use-cases/QueryInventory.js";
export { GetUnit } from "./application/use-cases/GetUnit.js";
export { GetAvailableUnits } from "./application/use-cases/GetAvailableUnits.js";
export { GetUnitsByBranch } from "./application/use-cases/GetUnitsByBranch.js";
export { GetUnitsByModel } from "./application/use-cases/GetUnitsByModel.js";
export { GetUnitsByPriceRange } from "./application/use-cases/GetUnitsByPriceRange.js";
export { DetectChanges, type DetectChangesInput } from "./application/use-cases/DetectChanges.js";

// Services
export { InventorySyncService } from "./application/services/InventorySyncService.js";
export { InventoryQueryService } from "./application/services/InventoryQueryService.js";
export { ConflictResolutionService } from "./application/services/ConflictResolutionService.js";

// Domain — Entities
export { InventoryUnit, type InventoryUnitProps } from "./domain/entities/InventoryUnit.js";
export {
  SyncSession,
  type SyncSessionProps,
  type SyncSessionStatus,
} from "./domain/entities/SyncSession.js";
export { InventorySnapshot } from "./domain/entities/InventorySnapshot.js";

// Domain — Value Objects
export { UnitId } from "./domain/value-objects/UnitId.js";
export { DmsUnitId } from "./domain/value-objects/DmsUnitId.js";
export { UnitBrand } from "./domain/value-objects/UnitBrand.js";
export { UnitModel } from "./domain/value-objects/UnitModel.js";
export { UnitYear } from "./domain/value-objects/UnitYear.js";
export { UnitPrice } from "./domain/value-objects/UnitPrice.js";
export { UnitKilometer } from "./domain/value-objects/UnitKilometer.js";
export {
  UnitTransmission,
  parseUnitTransmission,
} from "./domain/value-objects/UnitTransmission.js";
export { UnitStatus, parseUnitStatus } from "./domain/value-objects/UnitStatus.js";
export { UnitCondition } from "./domain/value-objects/UnitCondition.js";
export { SourceSystem } from "./domain/value-objects/SourceSystem.js";
export { SourcePriority, sourcePriorityFor } from "./domain/value-objects/SourcePriority.js";
export { SyncTimestamp } from "./domain/value-objects/SyncTimestamp.js";

// Domain — Events
export type {
  SyncCompleted,
  SyncFailed,
  UnitAdded,
  UnitUpdated,
  UnitSold,
  UnitReserved,
  InventoryChanged,
} from "./domain/events/index.js";
export { DssInventoryConnectorEvents } from "./domain/events/DssInventoryConnectorEvents.js";

// Errors
export {
  InventoryError,
  SyncError,
  AdapterError,
  UnitNotFoundError,
  ConflictResolutionError,
} from "./domain/errors/index.js";

// Contracts (for implementing custom adapters)
export type {
  IInventorySourceAdapter,
  RawInventoryUnit,
  AdapterHealth,
} from "./contracts/IInventorySourceAdapter.js";
export type { IInventoryStore } from "./contracts/IInventoryStore.js";
export type { IInventoryQueryService } from "./contracts/IInventoryQueryService.js";
export type { IConflictResolver } from "./contracts/IConflictResolver.js";

// Adapters (for dependency injection)
export {
  MockInventoryAdapter,
  MOCK_UNITS,
} from "./infrastructure/adapters/MockInventoryAdapter.js";
export { GoogleSheetsAdapter } from "./infrastructure/adapters/GoogleSheetsAdapter.js";
export { DmsAdapter } from "./infrastructure/adapters/DmsAdapter.js";
export { InventoryApiAdapter } from "./infrastructure/adapters/InventoryApiAdapter.js";

// Store
export { InMemoryInventoryStore } from "./infrastructure/store/InMemoryInventoryStore.js";

// Config
export type {
  InventoryConnectorConfig,
  InventoryConnectorConfigInput,
  SyncMode,
} from "./config/InventoryConnectorConfig.js";
export {
  InventoryConnectorConfigSchema,
  parseInventoryConnectorConfig,
} from "./config/InventoryConnectorConfig.js";

// Registry
export { InventorySourceRegistry } from "./infrastructure/registry/InventorySourceRegistry.js";

// Builders
export { InventoryUnitBuilder } from "./builders/InventoryUnitBuilder.js";
export { SyncSessionBuilder } from "./builders/SyncSessionBuilder.js";

// Utils
export { classifyModel, type ClassifiedModel } from "./utils/ModelClassifier.js";
export { estimatedDp, estimatedMonthly } from "./utils/PriceCalculator.js";
export { detectBranch } from "./utils/BranchDetector.js";

// Types
export type {
  SourceTaggedRawUnit,
  InventoryQueryCriteria,
  InventoryChangeSet,
  UnitChange,
} from "./types/InventoryTypes.js";
