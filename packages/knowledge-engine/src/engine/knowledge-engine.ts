import { KnowledgeCatalog } from "../catalog/knowledge-catalog.js";
import type { KnowledgeEngineConfig } from "../config/knowledge-engine-config.js";
import type { KnowledgeContext } from "../context/knowledge-context.js";
import { KnowledgeAssetType } from "../domain/knowledge-asset-type.js";
import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import { KnowledgeLifecycleState } from "../domain/knowledge-lifecycle-state.js";
import type { KnowledgePermission } from "../domain/knowledge-permission.js";
import type { KnowledgePolicy } from "../domain/knowledge-policy.js";
import type { KnowledgeRelationship } from "../domain/knowledge-relationship.js";
import type { KnowledgeSnapshot } from "../domain/knowledge-version.js";
import { KnowledgeValidationException } from "../errors/knowledge-validation-exception.js";
import { KnowledgeEventType } from "../events/knowledge-event-type.js";
import type { KnowledgeEvents } from "../events/knowledge-events.js";
import { KnowledgeFactory } from "../factory/knowledge-factory.js";
import type { KnowledgeHealthReport } from "../health/i-health-check.js";
import { KnowledgeLifecycle } from "../lifecycle/knowledge-lifecycle.js";
import { KnowledgeMetadataEngine } from "../metadata/knowledge-metadata-engine.js";
import type { KnowledgeMetricsSnapshot } from "../metrics/i-knowledge-metrics.js";
import { KnowledgeMetrics } from "../metrics/knowledge-metrics.js";
import type { KnowledgeDashboard } from "../monitoring/knowledge-monitor.js";
import { KnowledgeMonitor } from "../monitoring/knowledge-monitor.js";
import { KnowledgePermissionEngine } from "../permission/knowledge-permission-engine.js";
import { KnowledgePolicyEngine } from "../policy/knowledge-policy-engine.js";
import { KnowledgeRegistry } from "../registry/knowledge-registry.js";
import { KnowledgeRelationshipEngine } from "../relationship/knowledge-relationship-engine.js";
import { KnowledgeRepository } from "../repository/knowledge-repository.js";
import { KnowledgeResolver } from "../resolver/knowledge-resolver.js";
import { KnowledgeTemplateEngine } from "../template/knowledge-template-engine.js";
import { KnowledgeValidator } from "../validator/knowledge-validator.js";
import { KnowledgeVersionEngine } from "../version/knowledge-version-engine.js";

export interface KnowledgeEngineOptions {
  readonly events: KnowledgeEvents;
  readonly config?: KnowledgeEngineConfig;
}

/**
 * "Become the canonical source of enterprise knowledge ... This package defines the
 * Knowledge Domain." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md). The public façade —
 * composes Repository/Registry/Catalog/Resolver/Factory/Validator/Lifecycle/Policy/
 * Relationship/Permission/Version/Template/Metadata behind one entry point. Never
 * performs retrieval, embeddings, RAG, indexing, vector search, synchronization, or LLM
 * operations itself.
 */
export class KnowledgeEngine {
  readonly repository = new KnowledgeRepository();
  readonly registry = new KnowledgeRegistry();
  readonly catalog: KnowledgeCatalog;
  readonly resolver: KnowledgeResolver;
  readonly factory = new KnowledgeFactory();
  readonly validator = new KnowledgeValidator();
  readonly lifecycle = new KnowledgeLifecycle();
  readonly policyEngine: KnowledgePolicyEngine;
  readonly relationshipEngine: KnowledgeRelationshipEngine;
  readonly permissionEngine = new KnowledgePermissionEngine();
  readonly versionEngine: KnowledgeVersionEngine;
  readonly templateEngine: KnowledgeTemplateEngine;
  readonly metadataEngine = new KnowledgeMetadataEngine();
  private readonly metricsCollector = new KnowledgeMetrics();
  private readonly monitor: KnowledgeMonitor;

  constructor(private readonly options: KnowledgeEngineOptions) {
    this.catalog = new KnowledgeCatalog(this.repository);
    this.resolver = new KnowledgeResolver(this.repository);
    this.policyEngine = new KnowledgePolicyEngine(this.registry);
    this.relationshipEngine = new KnowledgeRelationshipEngine(this.registry);
    this.versionEngine = new KnowledgeVersionEngine(this.registry);
    this.templateEngine = new KnowledgeTemplateEngine(this.registry);
    this.monitor = new KnowledgeMonitor(this.metricsCollector, this.repository, this.registry);
  }

  async createAsset(asset: KnowledgeAsset, context: KnowledgeContext): Promise<KnowledgeAsset> {
    await this.assertValid(asset, context);
    const saved = this.repository.save(asset);
    this.recordAssetUsage(saved);
    await this.options.events.publishKnowledgeEvent(KnowledgeEventType.CREATED, context, {
      assetId: saved.id,
    });
    return saved;
  }

  async updateAsset(asset: KnowledgeAsset, context: KnowledgeContext): Promise<KnowledgeAsset> {
    await this.assertValid(asset, context);
    const updated = this.repository.update({ ...asset, updatedAt: new Date().toISOString() });
    await this.options.events.publishKnowledgeEvent(KnowledgeEventType.UPDATED, context, {
      assetId: updated.id,
    });
    return updated;
  }

  async deleteAsset(id: string, context: KnowledgeContext): Promise<boolean> {
    const removed = this.repository.remove(id);
    if (removed) {
      await this.options.events.publishKnowledgeEvent(KnowledgeEventType.DELETED, context, {
        assetId: id,
      });
    }
    return removed;
  }

  async archiveAsset(id: string, context: KnowledgeContext): Promise<KnowledgeAsset> {
    const asset = this.repository.require(id);
    const archived = this.lifecycle.transition({ asset, to: KnowledgeLifecycleState.ARCHIVED });
    this.repository.update(archived);
    await this.options.events.publishKnowledgeEvent(KnowledgeEventType.ARCHIVED, context, {
      assetId: id,
    });
    return archived;
  }

  async createVersion(id: string, context: KnowledgeContext): Promise<KnowledgeSnapshot> {
    const asset = this.repository.require(id);
    const snapshot = this.versionEngine.snapshot(asset);
    this.metricsCollector.recordVersionCreated();
    await this.options.events.publishKnowledgeEvent(KnowledgeEventType.VERSION_CREATED, context, {
      assetId: id,
      versionLabel: snapshot.version.label,
    });
    return snapshot;
  }

  async addRelationship(
    relationship: KnowledgeRelationship,
    context: KnowledgeContext,
  ): Promise<KnowledgeRelationship> {
    const added = this.relationshipEngine.add(relationship);
    this.metricsCollector.recordRelationshipCreated();
    await this.options.events.publishKnowledgeEvent(
      KnowledgeEventType.RELATIONSHIP_CREATED,
      context,
      { relationshipId: added.id },
    );
    return added;
  }

  async registerPolicy(
    policy: KnowledgePolicy,
    context: KnowledgeContext,
  ): Promise<KnowledgePolicy> {
    const registered = this.policyEngine.register(policy);
    this.metricsCollector.recordPolicyRegistered();
    await this.options.events.publishKnowledgeEvent(KnowledgeEventType.POLICY_CHANGED, context, {
      policyId: registered.id,
    });
    return registered;
  }

  async registerPermission(
    permission: KnowledgePermission,
    context: KnowledgeContext,
  ): Promise<KnowledgePermission> {
    const registered = this.permissionEngine.register(permission);
    await this.options.events.publishKnowledgeEvent(
      KnowledgeEventType.PERMISSION_CHANGED,
      context,
      { permissionId: registered.id },
    );
    return registered;
  }

  health(): KnowledgeHealthReport {
    return this.monitor.health.check();
  }

  metrics(): KnowledgeMetricsSnapshot {
    return this.metricsCollector.snapshot();
  }

  monitorSnapshot(): KnowledgeDashboard {
    return this.monitor.sample();
  }

  private async assertValid(asset: KnowledgeAsset, context: KnowledgeContext): Promise<void> {
    const result = this.validator.validate({
      asset,
      repository: this.repository,
      allowedLanguages: this.options.config?.allowedLanguages,
      allowedTenantIds: this.options.config?.allowedTenantIds,
      allowedWorkspaceIds: this.options.config?.allowedWorkspaceIds,
    });
    if (!result.valid) {
      this.metricsCollector.recordValidationError();
      await this.options.events.publishKnowledgeEvent(
        KnowledgeEventType.VALIDATION_FAILED,
        context,
        {
          assetId: asset.id,
          issues: result.issues,
        },
      );
      throw new KnowledgeValidationException(
        `KnowledgeAsset "${asset.id}" failed validation: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
      );
    }
  }

  private recordAssetUsage(asset: KnowledgeAsset): void {
    this.metricsCollector.recordAssetCreated(asset.assetType === KnowledgeAssetType.DOCUMENT);
    this.metricsCollector.recordTenantUsage(asset.scope.tenantId);
    if (asset.scope.departmentId) {
      this.metricsCollector.recordDepartmentUsage(asset.scope.departmentId);
    }
  }
}
