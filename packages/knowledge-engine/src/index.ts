/**
 * "PUBLIC API: KnowledgeEngine, KnowledgeSystem, KnowledgeRegistry, KnowledgeCatalog,
 * KnowledgeRepository, KnowledgeResolver, KnowledgeFactory, KnowledgeValidator,
 * KnowledgeLifecycle, KnowledgePolicyEngine, KnowledgeRelationshipEngine,
 * KnowledgePermissionEngine, KnowledgeVersionEngine, KnowledgeTemplateEngine,
 * KnowledgeMetadataEngine, KnowledgeMetrics, KnowledgeHealth, KnowledgeEvents,
 * KnowledgeContext." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md). The 19 named exports
 * below, plus the full Core Domain/Contracts/Factory-sub-class/Validator-stage/Errors
 * surface a caller needs to actually build and use them — matching the curation approach
 * established in `@aos/workflow-integration`.
 */
export { KnowledgeEngine } from "./engine/knowledge-engine.js";
export type { KnowledgeEngineOptions } from "./engine/knowledge-engine.js";

export { KnowledgeSystem } from "./bootstrap/knowledge-system.js";

export { KnowledgeRegistry } from "./registry/knowledge-registry.js";
export { KnowledgeRegistryBucket } from "./registry/knowledge-registry-bucket.js";
export type { KnowledgeProviderRegistration } from "./registry/knowledge-provider-registration.js";

export { KnowledgeCatalog } from "./catalog/knowledge-catalog.js";
export type { KnowledgeCatalogQuery } from "./catalog/knowledge-catalog-query.js";

export { KnowledgeRepository } from "./repository/knowledge-repository.js";

export { KnowledgeResolver } from "./resolver/knowledge-resolver.js";

export { KnowledgeFactory } from "./factory/knowledge-factory.js";
export { CollectionFactory } from "./factory/collection-factory.js";
export { DocumentFactory } from "./factory/document-factory.js";
export { MetadataFactory } from "./factory/metadata-factory.js";
export { PolicyFactory } from "./factory/policy-factory.js";
export { RelationshipFactory } from "./factory/relationship-factory.js";
export { TemplateFactory } from "./factory/template-factory.js";
export { VersionFactory } from "./factory/version-factory.js";

export { KnowledgeValidator } from "./validator/knowledge-validator.js";
export type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationIssue,
  KnowledgeValidationResult,
} from "./validator/i-knowledge-validator.js";
export { ClassificationValidator } from "./validator/classification-validator.js";
export { CollectionValidator } from "./validator/collection-validator.js";
export { LanguageValidator } from "./validator/language-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { NamespaceValidator } from "./validator/namespace-validator.js";
export { OwnershipValidator } from "./validator/ownership-validator.js";
export { PermissionValidator } from "./validator/permission-validator.js";
export { PolicyValidator } from "./validator/policy-validator.js";
export { RelationshipValidator } from "./validator/relationship-validator.js";
export { SchemaValidator } from "./validator/schema-validator.js";
export { TemplateValidator } from "./validator/template-validator.js";
export { TenantValidator } from "./validator/tenant-validator.js";
export { VersionValidator } from "./validator/version-validator.js";
export { WorkspaceValidator } from "./validator/workspace-validator.js";

export { KnowledgeLifecycle } from "./lifecycle/knowledge-lifecycle.js";
export type { KnowledgeLifecycleTransitionInput } from "./lifecycle/knowledge-lifecycle.js";

export { KnowledgePolicyEngine } from "./policy/knowledge-policy-engine.js";
export type { PolicyViolation } from "./policy/policy-violation.js";

export { KnowledgeRelationshipEngine } from "./relationship/knowledge-relationship-engine.js";

export { KnowledgePermissionEngine } from "./permission/knowledge-permission-engine.js";

export { KnowledgeVersionEngine } from "./version/knowledge-version-engine.js";
export type { KnowledgeVersionDiffEntry } from "./version/knowledge-version-engine.js";

export { KnowledgeTemplateEngine } from "./template/knowledge-template-engine.js";
export type { InstantiateTemplateInput } from "./template/knowledge-template-engine.js";

export { KnowledgeMetadataEngine } from "./metadata/knowledge-metadata-engine.js";

export { KnowledgeMetrics } from "./metrics/knowledge-metrics.js";
export type { IKnowledgeMetrics, KnowledgeMetricsSnapshot } from "./metrics/i-knowledge-metrics.js";

export { KnowledgeHealth } from "./health/knowledge-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  KnowledgeHealthReport,
} from "./health/i-health-check.js";

export { KnowledgeMonitor } from "./monitoring/knowledge-monitor.js";
export type { KnowledgeDashboard } from "./monitoring/knowledge-monitor.js";

export { KnowledgeEvents } from "./events/knowledge-events.js";
export { KnowledgeEventType } from "./events/knowledge-event-type.js";

export {
  createKnowledgeContext,
  type CreateKnowledgeContextInput,
} from "./context/create-knowledge-context.js";
export { knowledgeContextSchema, type KnowledgeContext } from "./context/knowledge-context.js";

export * from "./domain/index.js";
export * from "./contracts/index.js";
export * from "./errors/index.js";
export * from "./namespace/index.js";

export type { KnowledgeEngineConfig } from "./config/knowledge-engine-config.js";
