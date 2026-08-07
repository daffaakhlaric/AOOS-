import type { KnowledgeVersioningConfig } from "../config/knowledge-versioning-config.js";
import { KnowledgeVersionConfiguration } from "../configuration/knowledge-version-configuration.js";
import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";
import type {
  ArchiveVersionInput,
  CloneVersionInput,
  CompareVersionInput,
  CompareVersionResult,
  CreateVersionInput,
  DestroyVersionInput,
  ForkVersionInput,
  ForkVersionResult,
  MergeVersionInput,
  MergeVersionResult,
  PublishVersionInput,
  RestoreVersionInput,
  RollbackVersionInput,
  RollbackVersionResult,
  SnapshotVersionInput,
  SnapshotVersionResult,
} from "../contracts/i-knowledge-version-operations.js";
import type { KnowledgeHistory } from "../domain/knowledge-history.js";
import { KnowledgeLineage } from "../domain/knowledge-lineage.js";
import type { KnowledgeVersionExecution } from "../domain/knowledge-version-execution.js";
import { KnowledgeVersionOperation } from "../domain/knowledge-version-operation.js";
import { KnowledgeVersionState } from "../domain/knowledge-version-state.js";
import { KnowledgeVersion } from "../domain/knowledge-version.js";
import { SnapshotLimitExceededException } from "../errors/snapshot-limit-exceeded-exception.js";
import { VersionOperationException } from "../errors/version-operation-exception.js";
import { KnowledgeVersionEventType } from "../events/knowledge-version-event-type.js";
import type { KnowledgeVersionEvents } from "../events/knowledge-version-events.js";
import { KnowledgeVersionFactory } from "../factory/knowledge-version-factory.js";
import type { KnowledgeVersionHealthReport } from "../health/i-health-check.js";
import { KnowledgeVersionManager } from "../manager/knowledge-version-manager.js";
import type { KnowledgeVersionMetricsSnapshot } from "../metrics/i-knowledge-version-metrics-collector.js";
import { KnowledgeVersionMetrics } from "../metrics/knowledge-version-metrics.js";
import {
  KnowledgeVersionMiddleware,
  type VersionMiddleware,
} from "../middleware/knowledge-version-middleware.js";
import type { KnowledgeVersionDashboard } from "../monitoring/knowledge-version-monitoring.js";
import { KnowledgeVersionMonitoring } from "../monitoring/knowledge-version-monitoring.js";
import { KnowledgeVersionPermission } from "../permission/knowledge-version-permission.js";
import { KnowledgeVersionPipeline } from "../pipeline/knowledge-version-pipeline.js";
import { KnowledgeVersionPolicy } from "../policy/knowledge-version-policy.js";
import { KnowledgeVersionRegistryBucket } from "../registry/knowledge-version-registry-bucket.js";
import type { VersionRegistryEntry } from "../registry/version-registry-entry.js";
import { KnowledgeVersionResolver } from "../resolver/knowledge-version-resolver.js";
import { generateKnowledgeVersionToken } from "../token/knowledge-version-token.js";
import { generateId } from "../utils/id.js";
import { KnowledgeVersionValidator } from "../validator/knowledge-version-validator.js";

export interface KnowledgeVersioningOptions {
  readonly events: KnowledgeVersionEvents;
  readonly config?: KnowledgeVersioningConfig;
}

/**
 * "KnowledgeVersioning" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API") — the
 * public façade, distinct from the mid-level `manager/`'s `KnowledgeVersionManager`. Owns
 * the State Machine + Pipeline + Middleware + Manager + Resolver + Policy + Permission,
 * and implements the 11 Version Operations as real metadata/lifecycle methods: validate ->
 * drive the State Machine to the correct target state via one atomic Pipeline call ->
 * record the relevant domain metadata (history entry, lineage edge, branch/snapshot/
 * merge/comparison record as applicable) -> update statistics -> publish the matching
 * event -> return the updated `KnowledgeVersion`. Merge/Compare/Rollback record metadata
 * and transition state only — "No merge algorithm. No diff engine." — real algorithms are
 * deferred to the interface-only Extension Points in `config.mergeStrategy`/
 * `config.comparisonEngine`/`config.diffProvider`/`config.rollbackProvider`, optionally
 * invoked when a caller supplies one, never required.
 */
export class KnowledgeVersioning {
  readonly manager = new KnowledgeVersionManager();
  readonly resolver: KnowledgeVersionResolver;
  readonly validator: KnowledgeVersionValidator;
  readonly policy = new KnowledgeVersionPolicy();
  readonly permission = new KnowledgeVersionPermission();
  readonly factory = new KnowledgeVersionFactory();
  readonly middleware = new KnowledgeVersionMiddleware();
  readonly configuration = new KnowledgeVersionConfiguration();
  private readonly metricsCollector = new KnowledgeVersionMetrics();
  private readonly monitoring: KnowledgeVersionMonitoring;
  private readonly pipeline: KnowledgeVersionPipeline;
  private readonly snapshotCountByVersionId = new Map<string, number>();

  constructor(private readonly options: KnowledgeVersioningOptions) {
    this.resolver = new KnowledgeVersionResolver(this.manager.registry);
    this.validator = new KnowledgeVersionValidator({
      policy: this.policy,
      permission: this.permission,
    });
    this.monitoring = new KnowledgeVersionMonitoring(this.metricsCollector, this.manager.registry);
    this.pipeline = new KnowledgeVersionPipeline(
      this.validator,
      this.permission,
      this.policy,
      this.metricsCollector,
    );
  }

  use(middleware: VersionMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  /** Registers a brand-new Version — drives Draft -> Created -> Validated via two atomic Pipeline calls. */
  async createVersion(input: CreateVersionInput): Promise<KnowledgeVersion> {
    this.configuration.assertValid(input.configuration);
    let execution = this.buildExecution(input.metadata, input.configuration, input.context);
    this.manager.register(execution);

    execution = await this.runPipeline(
      execution,
      input.context,
      KnowledgeVersionOperation.CREATE_VERSION,
      KnowledgeVersionState.CREATED,
    );
    execution = await this.runPipeline(
      execution,
      input.context,
      KnowledgeVersionOperation.CREATE_VERSION,
      KnowledgeVersionState.VALIDATED,
    );

    this.registerVersionEntry(execution);
    this.recordHistory(execution.metadata.versionId, {
      operation: KnowledgeVersionOperation.CREATE_VERSION,
      toState: execution.instance.state,
    });
    this.manager.statistics.recordCreated(execution.metadata.versionType);
    this.metricsCollector.recordVersion();

    await this.publish(KnowledgeVersionEventType.VERSION_CREATED, execution.context, {
      versionId: execution.metadata.versionId,
    });
    await this.publish(KnowledgeVersionEventType.HISTORY_RECORDED, execution.context, {
      versionId: execution.metadata.versionId,
    });

    return new KnowledgeVersion(execution);
  }

  /** Publishes a Validated/Restored Version. */
  async publishVersion(input: PublishVersionInput): Promise<KnowledgeVersion> {
    const before = this.manager.require(input.token);
    const execution = await this.runPipeline(
      before,
      before.context,
      KnowledgeVersionOperation.PUBLISH_VERSION,
      KnowledgeVersionState.PUBLISHED,
      input.reason,
    );
    this.registerVersionEntry(execution);
    this.recordHistory(execution.metadata.versionId, {
      operation: KnowledgeVersionOperation.PUBLISH_VERSION,
      fromState: before.instance.state,
      toState: execution.instance.state,
      reason: input.reason,
    });
    this.manager.statistics.recordPublished(execution.metadata.versionType);
    this.metricsCollector.recordPublish();
    await this.publish(KnowledgeVersionEventType.VERSION_PUBLISHED, execution.context, {
      versionId: execution.metadata.versionId,
    });
    return new KnowledgeVersion(execution);
  }

  /** Archives a Published/Superseded/Deprecated/Restored Version. */
  async archiveVersion(input: ArchiveVersionInput): Promise<KnowledgeVersion> {
    const before = this.manager.require(input.token);
    const execution = await this.runPipeline(
      before,
      before.context,
      KnowledgeVersionOperation.ARCHIVE_VERSION,
      KnowledgeVersionState.ARCHIVED,
      input.reason,
    );
    this.recordHistory(execution.metadata.versionId, {
      operation: KnowledgeVersionOperation.ARCHIVE_VERSION,
      fromState: before.instance.state,
      toState: execution.instance.state,
      reason: input.reason,
    });
    this.metricsCollector.recordArchive();
    await this.publish(KnowledgeVersionEventType.VERSION_ARCHIVED, execution.context, {
      versionId: execution.metadata.versionId,
    });
    return new KnowledgeVersion(execution);
  }

  /** Restores a Deprecated/Archived/RolledBack Version. */
  async restoreVersion(input: RestoreVersionInput): Promise<KnowledgeVersion> {
    const before = this.manager.require(input.token);
    const execution = await this.runPipeline(
      before,
      before.context,
      KnowledgeVersionOperation.RESTORE_VERSION,
      KnowledgeVersionState.RESTORED,
      input.reason,
    );
    this.recordHistory(execution.metadata.versionId, {
      operation: KnowledgeVersionOperation.RESTORE_VERSION,
      fromState: before.instance.state,
      toState: execution.instance.state,
      reason: input.reason,
    });
    await this.publish(KnowledgeVersionEventType.VERSION_RESTORED, execution.context, {
      versionId: execution.metadata.versionId,
    });
    return new KnowledgeVersion(execution);
  }

  /** Rolls a Published Version back to an earlier target version — records a `KnowledgeRollback` metadata entry only. */
  async rollbackVersion(input: RollbackVersionInput): Promise<RollbackVersionResult> {
    const before = this.manager.require(input.token);
    if (!before.configuration.allowRollback) {
      throw new VersionOperationException(
        `Version "${before.metadata.versionId}" configuration has allowRollback=false`,
      );
    }
    const execution = await this.runPipeline(
      before,
      before.context,
      KnowledgeVersionOperation.ROLLBACK_VERSION,
      KnowledgeVersionState.ROLLED_BACK,
      input.reason,
    );
    this.recordHistory(execution.metadata.versionId, {
      operation: KnowledgeVersionOperation.ROLLBACK_VERSION,
      fromState: before.instance.state,
      toState: execution.instance.state,
      reason: input.reason,
    });
    this.metricsCollector.recordRollback();
    const rollback = {
      id: generateId(),
      versionId: execution.metadata.versionId,
      targetVersionId: input.targetVersionId,
      reason: input.reason,
      initiatedBy: execution.context.metadata.actor as string | undefined,
      occurredAt: new Date().toISOString(),
    };
    if (this.options.config?.rollbackProvider) {
      await this.options.config.rollbackProvider.rollback(rollback);
    }
    await this.publish(KnowledgeVersionEventType.VERSION_ROLLED_BACK, execution.context, {
      versionId: execution.metadata.versionId,
      targetVersionId: input.targetVersionId,
    });
    return { version: new KnowledgeVersion(execution), rollback };
  }

  /** Merges a source Version into a target Version — records a `KnowledgeMerge` metadata entry only. */
  async mergeVersion(input: MergeVersionInput): Promise<MergeVersionResult> {
    const before = this.manager.require(input.token);
    if (!before.configuration.allowMerge) {
      throw new VersionOperationException(
        `Version "${before.metadata.versionId}" configuration has allowMerge=false`,
      );
    }
    const execution = await this.runPipeline(
      before,
      before.context,
      KnowledgeVersionOperation.MERGE_VERSION,
      KnowledgeVersionState.MERGED,
      input.reason,
    );
    this.recordHistory(execution.metadata.versionId, {
      operation: KnowledgeVersionOperation.MERGE_VERSION,
      fromState: before.instance.state,
      toState: execution.instance.state,
      reason: input.reason,
    });
    this.metricsCollector.recordMerge();
    const merge = {
      id: generateId(),
      sourceVersionId: execution.metadata.versionId,
      targetVersionId: input.targetVersionId,
      strategy: input.strategy,
      initiatedBy: execution.context.metadata.actor as string | undefined,
      occurredAt: new Date().toISOString(),
    };
    if (this.options.config?.mergeStrategy) {
      await this.options.config.mergeStrategy.apply(merge);
    }
    await this.publish(KnowledgeVersionEventType.VERSION_MERGED, execution.context, {
      versionId: execution.metadata.versionId,
      targetVersionId: input.targetVersionId,
    });
    return { version: new KnowledgeVersion(execution), merge };
  }

  /** Records comparison metadata between two versions — no state transition, no diff engine. */
  async compareVersion(input: CompareVersionInput): Promise<CompareVersionResult> {
    const execution = this.manager.require(input.token);
    let result = input.result;
    if (result === undefined && this.options.config?.comparisonEngine) {
      result = await this.options.config.comparisonEngine.compare(
        execution.metadata.versionId,
        input.rightVersionId,
      );
    }
    const comparison = {
      id: generateId(),
      leftVersionId: execution.metadata.versionId,
      rightVersionId: input.rightVersionId,
      result,
      comparedBy: execution.context.metadata.actor as string | undefined,
      comparedAt: new Date().toISOString(),
    };
    this.manager.registry.register(KnowledgeVersionRegistryBucket.METADATA, comparison);
    this.metricsCollector.recordComparison();
    await this.publish(KnowledgeVersionEventType.COMPARISON_COMPLETED, execution.context, {
      leftVersionId: comparison.leftVersionId,
      rightVersionId: comparison.rightVersionId,
    });
    return { comparison };
  }

  /** Clones a Version's metadata under a new `versionId`, recording a lineage edge from the original. */
  async cloneVersion(input: CloneVersionInput): Promise<KnowledgeVersion> {
    const source = this.manager.require(input.token);
    const clonedMetadata = this.factory.metadata.update(
      { ...source.metadata, versionId: input.newVersionId },
      { versionName: input.newVersionName ?? source.metadata.versionName },
    );
    const newContext: KnowledgeVersionContext = {
      ...source.context,
      token: generateKnowledgeVersionToken(),
      versionId: input.newVersionId,
      correlationId: generateId(),
    };
    const cloned = await this.createVersion({
      metadata: clonedMetadata,
      configuration: { ...source.configuration, versionId: input.newVersionId },
      context: newContext,
    });
    this.ensureLineage(source.metadata.assetId).addEdge(
      source.metadata.versionId,
      input.newVersionId,
    );
    return cloned;
  }

  /** Forks a new Branch off the current Version and creates the Branch's initial Version. */
  async forkVersion(input: ForkVersionInput): Promise<ForkVersionResult> {
    const source = this.manager.require(input.token);
    const branch = this.factory.branch.create({
      name: input.branchName,
      branchType: input.branchType,
      assetId: source.metadata.assetId,
      tenantId: source.context.tenantId,
      workspaceId: source.context.workspaceId,
      sourceBranchId: source.metadata.branchId,
    });
    this.manager.registry.register(KnowledgeVersionRegistryBucket.BRANCH, branch);
    this.metricsCollector.recordBranch();
    await this.publish(KnowledgeVersionEventType.BRANCH_CREATED, source.context, {
      branchId: branch.id,
    });

    const forkedMetadata = this.factory.metadata.update(
      { ...source.metadata, versionId: input.newVersionId, branchId: branch.id },
      {},
    );
    const newContext: KnowledgeVersionContext = {
      ...source.context,
      token: generateKnowledgeVersionToken(),
      versionId: input.newVersionId,
      branchId: branch.id,
      correlationId: generateId(),
    };
    const forked = await this.createVersion({
      metadata: forkedMetadata,
      configuration: { ...source.configuration, versionId: input.newVersionId },
      context: newContext,
    });
    this.ensureLineage(source.metadata.assetId).addEdge(
      source.metadata.versionId,
      input.newVersionId,
    );
    const registeredBranch = { ...branch, headVersionId: input.newVersionId };
    this.manager.registry.replace(KnowledgeVersionRegistryBucket.BRANCH, registeredBranch);
    return { version: forked, branch: registeredBranch };
  }

  /** Captures a point-in-time Snapshot of the current Version, enforcing the configured `maxSnapshots` budget. */
  async snapshotVersion(input: SnapshotVersionInput): Promise<SnapshotVersionResult> {
    const execution = this.manager.require(input.token);
    const maxSnapshots = execution.configuration.maxSnapshots;
    const currentCount = this.snapshotCountByVersionId.get(execution.metadata.versionId) ?? 0;
    if (maxSnapshots !== undefined && currentCount >= maxSnapshots) {
      throw new SnapshotLimitExceededException(
        `Version "${execution.metadata.versionId}" already has ${String(currentCount)} Snapshots — maxSnapshots budget is ${String(maxSnapshots)}`,
      );
    }
    const snapshot = this.factory.snapshot.create({
      versionId: execution.metadata.versionId,
      name: input.name,
      capturedState: execution.instance.state,
      reason: input.reason,
      capturedBy: execution.context.metadata.actor as string | undefined,
    });
    this.manager.registry.register(KnowledgeVersionRegistryBucket.SNAPSHOT, snapshot);
    this.snapshotCountByVersionId.set(execution.metadata.versionId, currentCount + 1);
    this.metricsCollector.recordSnapshot();
    if (this.options.config?.snapshotProvider) {
      await this.options.config.snapshotProvider.capture(snapshot);
    }
    await this.publish(KnowledgeVersionEventType.SNAPSHOT_CREATED, execution.context, {
      snapshotId: snapshot.id,
    });
    return { snapshot };
  }

  /** Destroys a Version — the sole hard-terminal transition. */
  async destroyVersion(input: DestroyVersionInput): Promise<KnowledgeVersion> {
    const before = this.manager.require(input.token);
    const execution = await this.runPipeline(
      before,
      before.context,
      KnowledgeVersionOperation.DESTROY_VERSION,
      KnowledgeVersionState.DESTROYED,
      input.reason,
    );
    this.recordHistory(execution.metadata.versionId, {
      operation: KnowledgeVersionOperation.DESTROY_VERSION,
      fromState: before.instance.state,
      toState: execution.instance.state,
      reason: input.reason,
    });
    await this.publish(KnowledgeVersionEventType.VERSION_DESTROYED, execution.context, {
      versionId: execution.metadata.versionId,
    });
    return new KnowledgeVersion(execution);
  }

  get(token: string): KnowledgeVersion | undefined {
    const execution = this.manager.get(token);
    return execution ? new KnowledgeVersion(execution) : undefined;
  }

  require(token: string): KnowledgeVersion {
    return new KnowledgeVersion(this.manager.require(token));
  }

  list(tenantId?: string): readonly KnowledgeVersion[] {
    return this.manager.list(tenantId).map((execution) => new KnowledgeVersion(execution));
  }

  count(): number {
    return this.manager.count();
  }

  health(): KnowledgeVersionHealthReport {
    return this.monitoring.sample().health;
  }

  metrics(): KnowledgeVersionMetricsSnapshot {
    return this.monitoring.sample().metrics;
  }

  monitorSnapshot(): KnowledgeVersionDashboard {
    return this.monitoring.sample();
  }

  private async runPipeline(
    execution: KnowledgeVersionExecution,
    context: KnowledgeVersionContext,
    operation: string,
    targetState: KnowledgeVersionState,
    reason?: string,
  ): Promise<KnowledgeVersionExecution> {
    const branch =
      execution.metadata.branchId !== undefined
        ? this.resolver.tryResolveBranch(execution.metadata.branchId)
        : undefined;
    const result = await this.pipeline.run({
      execution,
      context,
      operation,
      targetState,
      reason,
      branch,
    });
    await this.middleware.run(result);
    this.manager.update(result);
    return result;
  }

  private async publish(
    type: KnowledgeVersionEventType,
    context: KnowledgeVersionContext,
    extra: Readonly<Record<string, unknown>> = {},
  ): Promise<void> {
    await this.options.events.publishVersionEvent(type, context, extra);
  }

  private registerVersionEntry(execution: KnowledgeVersionExecution): void {
    const entry: VersionRegistryEntry = {
      id: execution.metadata.versionId,
      token: execution.instance.token,
      metadata: execution.metadata,
      configuration: execution.configuration,
    };
    if (this.manager.registry.get(KnowledgeVersionRegistryBucket.VERSION, entry.id)) {
      this.manager.registry.replace(KnowledgeVersionRegistryBucket.VERSION, entry);
      return;
    }
    this.manager.registry.register(KnowledgeVersionRegistryBucket.VERSION, entry);
  }

  private recordHistory(
    versionId: string,
    input: {
      operation: string;
      fromState?: KnowledgeVersionState;
      toState?: KnowledgeVersionState;
      reason?: string;
    },
  ): void {
    this.ensureHistory(versionId).record(input);
  }

  private ensureHistory(versionId: string): KnowledgeHistory {
    const existing = this.manager.registry.get<KnowledgeHistory>(
      KnowledgeVersionRegistryBucket.HISTORY,
      versionId,
    );
    if (existing) {
      return existing;
    }
    const created = this.factory.history.create(versionId);
    this.manager.registry.register(KnowledgeVersionRegistryBucket.HISTORY, created);
    return created;
  }

  private ensureLineage(assetId: string): KnowledgeLineage {
    const existing = this.manager.registry.get<KnowledgeLineage>(
      KnowledgeVersionRegistryBucket.LINEAGE,
      assetId,
    );
    if (existing) {
      return existing;
    }
    const created = new KnowledgeLineage(assetId);
    this.manager.registry.register(KnowledgeVersionRegistryBucket.LINEAGE, created);
    return created;
  }

  private buildExecution(
    metadata: CreateVersionInput["metadata"],
    configuration: CreateVersionInput["configuration"],
    context: KnowledgeVersionContext,
  ): KnowledgeVersionExecution {
    const now = new Date().toISOString();
    return {
      instance: {
        id: generateId(),
        token: context.token,
        versionId: metadata.versionId,
        assetId: metadata.assetId,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        state: KnowledgeVersionState.DRAFT,
        createdAt: now,
        updatedAt: now,
      },
      context,
      metadata,
      configuration,
      history: [],
      auditTrail: [],
      logs: [],
    };
  }
}
