// Factory
export { BranchManagerFactory } from "./factories/BranchManagerFactory.js";
export type {
  BranchManager,
  BranchManagerFactoryOptions,
} from "./factories/BranchManagerFactory.js";

// Use Cases
export { AssignLead } from "./application/use-cases/AssignLead.js";
export { DetectBranch } from "./application/use-cases/DetectBranch.js";
export type { DetectBranchInput } from "./application/use-cases/DetectBranch.js";
export { UpdateSalesStatus } from "./application/use-cases/UpdateSalesStatus.js";
export type { UpdateSalesStatusInput } from "./application/use-cases/UpdateSalesStatus.js";
export { AddSalesHuman } from "./application/use-cases/AddSalesHuman.js";
export type { AddSalesHumanInput } from "./application/use-cases/AddSalesHuman.js";
export { RemoveSalesHuman } from "./application/use-cases/RemoveSalesHuman.js";
export type { RemoveSalesHumanInput } from "./application/use-cases/RemoveSalesHuman.js";
export { GetBranchStatus } from "./application/use-cases/GetBranchStatus.js";
export type {
  BranchStatus,
  GetBranchStatusInput,
} from "./application/use-cases/GetBranchStatus.js";
export { GetAssignmentQueue } from "./application/use-cases/GetAssignmentQueue.js";
export type { GetAssignmentQueueInput } from "./application/use-cases/GetAssignmentQueue.js";
export { FlushQueue } from "./application/use-cases/FlushQueue.js";
export type { FlushQueueInput } from "./application/use-cases/FlushQueue.js";
export { GetAvailableSales } from "./application/use-cases/GetAvailableSales.js";
export type { GetAvailableSalesInput } from "./application/use-cases/GetAvailableSales.js";

// Services
export { LeadAssignmentService } from "./application/services/LeadAssignmentService.js";
export type {
  AssignLeadError,
  AssignLeadInput,
  AssignLeadOutcome,
} from "./application/services/LeadAssignmentService.js";
export { AvailabilityService } from "./application/services/AvailabilityService.js";
export { QueueService } from "./application/services/QueueService.js";
export type {
  QueueEnqueueInput,
  QueueFlushContext,
  QueueFlushResult,
} from "./application/services/QueueService.js";

// Domain
export { Branch } from "./domain/entities/Branch.js";
export type { BranchConfig } from "./domain/entities/BranchConfig.js";
export type { SalesHuman } from "./domain/entities/SalesHuman.js";
export type { LeadAssignment } from "./domain/entities/LeadAssignment.js";
export {
  AssignmentQueue,
  createQueuedLead,
  QueuedLeadSchema,
} from "./domain/entities/AssignmentQueue.js";
export type { QueuedLead } from "./domain/entities/AssignmentQueue.js";
export { BranchId, ALL_BRANCH_IDS, fromBranch, toBranch } from "./domain/value-objects/BranchId.js";
export { SalesStatus, parseSalesStatus } from "./domain/value-objects/SalesStatus.js";
export { AssignmentMode, parseAssignmentMode } from "./domain/value-objects/AssignmentMode.js";
export { SalesHumanId } from "./domain/value-objects/SalesHumanId.js";
export { AssignmentId } from "./domain/value-objects/AssignmentId.js";
export { ActiveLeadCount } from "./domain/value-objects/ActiveLeadCount.js";
export { DailyLeadCount } from "./domain/value-objects/DailyLeadCount.js";
export { MaxLeadsPerDay } from "./domain/value-objects/MaxLeadsPerDay.js";
export type { WabaPhoneNumberId } from "./domain/value-objects/WabaPhoneNumberId.js";

// Events
export type {
  LeadAssigned,
  LeadQueued,
  LeadQueuedReason,
  SalesStatusChanged,
  BranchConfigUpdated,
  QueueFlushed,
} from "./domain/events/index.js";
export { BranchManagerEvents } from "./domain/events/BranchManagerEvents.js";

// Errors
export {
  BranchManagerError,
  BranchNotFoundError,
  SalesHumanNotFoundError,
  NoAvailableSalesError,
  AssignmentError,
  BranchConfigError,
} from "./domain/errors/index.js";

// Config
export type {
  BranchManagerConfig,
  BranchManagerConfigInput,
} from "./config/BranchManagerConfig.js";
export {
  BranchManagerConfigSchema,
  parseBranchManagerConfig,
} from "./config/BranchManagerConfig.js";

// Registry
export { BranchRegistry } from "./registry/BranchRegistry.js";
export { SalesTeamRegistry } from "./registry/SalesTeamRegistry.js";

// Strategies (for custom assignment)
export type {
  IAssignmentStrategy,
  StrategyAssigned,
  StrategyPending,
  StrategySelection,
} from "./contracts/IAssignmentStrategy.js";
export { SmartAssignStrategy } from "./intelligence/SmartAssignStrategy.js";
export { RoundRobinStrategy } from "./intelligence/RoundRobinStrategy.js";
export { ManualAssignStrategy } from "./intelligence/ManualAssignStrategy.js";

// Contracts
export type { IBranchRegistry } from "./contracts/IBranchRegistry.js";
export type { ISalesTeamRegistry } from "./contracts/ISalesTeamRegistry.js";
export type { IAvailabilityTracker } from "./contracts/IAvailabilityTracker.js";

// Builders
export { BranchConfigBuilder } from "./builders/BranchConfigBuilder.js";
export { SalesHumanBuilder } from "./builders/SalesHumanBuilder.js";
export { LeadAssignmentBuilder } from "./builders/LeadAssignmentBuilder.js";
