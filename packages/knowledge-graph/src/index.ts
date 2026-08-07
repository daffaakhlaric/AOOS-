/**
 * `@aos/knowledge-graph` public API — a curated facade surface, not a re-export of every internal
 * module. Pipeline-stage functions, individual algorithm modules, and internal wiring
 * (`GraphOperationDescriptor`, `runValidationStage`, ...) are intentionally NOT exported here; a
 * consumer wanting those has opted into an unsupported deep import.
 *
 * The entry point most consumers need is the `KnowledgeGraph` facade (or `KnowledgeGraphSystem`
 * from `bootstrap/` if hosting inside an `IModule`-shaped kernel). The 5 Managers, Registries,
 * Factories, Events, Metrics, Monitoring, Statistics, and Configuration are also exported directly
 * for consumers who want finer-grained composition than the facade offers.
 */

// ---- Application facade ----
export { KnowledgeGraph } from "./application/knowledge-graph-facade.js";
export type { KnowledgeGraphFacadeOptions } from "./application/knowledge-graph-facade.js";

// ---- Bootstrap ----
export { KnowledgeGraphSystem, createKnowledgeGraphSystem } from "./bootstrap/index.js";

// ---- Managers ----
export {
  KnowledgeGraphManager,
  RelationshipManager,
  TraversalManager,
  AnalyticsManager,
  ReasoningManager,
  createGraphSystemContext,
} from "./manager/index.js";
export type { GraphSystemContext, KnowledgeGraphManagerOptions } from "./manager/index.js";

// ---- Registry ----
export {
  GraphRegistry,
  NodeRegistry,
  EdgeRegistry,
  RelationshipRegistry,
  SnapshotRegistry,
  ConfigurationRegistry,
  DEFAULT_CONFIGURATION_KEY,
} from "./registry/index.js";
export type { NodeRegistryEntry, EdgeRegistryEntry } from "./registry/index.js";

// ---- Factory ----
export {
  GraphFactory,
  GraphSnapshotFactory,
  KnowledgeNodeFactory,
  KnowledgeEdgeFactory,
} from "./factory/index.js";

// ---- Events ----
export {
  KnowledgeGraphEventType,
  InMemoryEventPublisher,
  NoOpEventPublisher,
} from "./events/index.js";
export type { KnowledgeGraphEventHandler, RecordedKnowledgeGraphEvent } from "./events/index.js";

// ---- Metrics ----
export { KnowledgeGraphMetricsCollector } from "./metrics/index.js";

// ---- Monitoring ----
export { KnowledgeGraphMonitor } from "./monitoring/index.js";
export type {
  HealthReport,
  HealthStatus,
  PerformanceReport,
  GraphSizeReport,
} from "./monitoring/index.js";

// ---- Statistics ----
export { GraphStatisticsService } from "./statistics/index.js";

// ---- Configuration ----
export { ConfigurationService } from "./configuration/index.js";

// ---- Middleware ----
export { LoggingMiddleware, TimingMiddleware } from "./middleware/index.js";
export type { PipelineMiddleware, PipelineLogEntry } from "./middleware/index.js";

// ---- Infrastructure ----
export { PermissiveAuthorizationChecker } from "./infrastructure/index.js";

// ---- Domain ----
export { KnowledgeNodeType, isKnowledgeNodeType } from "./domain/knowledge-node-type.js";
export { KnowledgeEdgeType, isKnowledgeEdgeType } from "./domain/knowledge-edge-type.js";
export type {
  KnowledgeNode,
  CreateKnowledgeNodeInput,
  UpdateKnowledgeNodeInput,
  KnowledgeEdge,
  CreateKnowledgeEdgeInput,
  UpdateKnowledgeEdgeInput,
  KnowledgeGraph as KnowledgeGraphAggregate,
  CreateKnowledgeGraphInput,
  GraphRelationship,
  GraphTraversal,
  GraphPath,
  GraphCluster,
  GraphSnapshot,
  GraphVersion,
  GraphStatistics,
  GraphMetrics,
  GraphConfiguration,
  ResolvedGraphConfiguration,
} from "./domain/index.js";

// ---- Contracts ----
export type {
  IGraphAuthorizationChecker,
  GraphAuthorizationRequest,
  IKnowledgeGraphEventPublisher,
  IKnowledgeGraphModule,
} from "./contracts/index.js";

// ---- Graph engine (advanced composition) ----
export { GraphEngine } from "./graph/graph-engine.js";
export type { GraphMergeConflictResolution, GraphMergeResult } from "./graph/graph-merge.js";
export type { GraphValidationIssue, GraphValidationReport } from "./graph/graph-validator.js";

// ---- Traversal option / result types ----
export type { TraversalOptions, NeighborDirection } from "./traversal/index.js";
export type { CycleDetectionResult } from "./analytics/index.js";
export type { ImpactAnalysisResult } from "./reasoning/index.js";

// ---- Query ----
export { executeGraphQuery } from "./queries/index.js";
export type {
  GraphQuery,
  FilterQuery,
  SearchQuery,
  TraversalQueryInput,
  PathQueryInput,
  RelationshipQueryInput,
  DependencyQueryInput,
  AnalyticsQueryInput,
} from "./queries/index.js";

// ---- Pipeline (operation catalogue only — stages are internal wiring) ----
export { GraphOperationType } from "./pipeline/graph-operation-type.js";

// ---- Errors ----
export {
  KnowledgeGraphException,
  GraphNotFoundException,
  NodeNotFoundException,
  EdgeNotFoundException,
  SnapshotNotFoundException,
  DuplicateEntryException,
  GraphValidationException,
  GraphAuthorizationException,
  RelationshipValidationException,
  CycleDetectedException,
  GraphConfigurationException,
} from "./errors/index.js";
export type { KnowledgeGraphExceptionOptions } from "./errors/index.js";
