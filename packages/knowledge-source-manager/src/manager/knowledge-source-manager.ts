import { KnowledgeSourceCatalog } from "../catalog/knowledge-source-catalog.js";
import type { KnowledgeSourceManagerConfig } from "../config/knowledge-source-manager-config.js";
import type { KnowledgeSourceConfigurationRecord } from "../configuration/knowledge-source-configuration-record.js";
import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { KnowledgeSourceExecution } from "../domain/knowledge-source-execution.js";
import type { KnowledgeSourceInstance } from "../domain/knowledge-source-instance.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";
import { KnowledgeSourceState } from "../domain/knowledge-source-state.js";
import { SourceNotFoundException } from "../errors/source-not-found-exception.js";
import { KnowledgeSourceEventType } from "../events/knowledge-source-event-type.js";
import type { KnowledgeSourceEvents } from "../events/knowledge-source-events.js";
import { KnowledgeSourceFactory } from "../factory/knowledge-source-factory.js";
import type { KnowledgeSourceHealthReport } from "../health/i-health-check.js";
import type { KnowledgeSourceMetricsSnapshot } from "../metrics/i-knowledge-source-metrics-collector.js";
import { KnowledgeSourceMetrics } from "../metrics/knowledge-source-metrics.js";
import {
  KnowledgeSourceMiddlewarePipeline,
  type SourceMiddleware,
} from "../middleware/knowledge-source-middleware.js";
import { KnowledgeSourceMonitor } from "../monitoring/knowledge-source-monitor.js";
import type { KnowledgeSourceDashboard } from "../monitoring/knowledge-source-monitor.js";
import type { KnowledgeSourcePermissionGrant } from "../permission/knowledge-source-permission-grant.js";
import { KnowledgeSourcePermission } from "../permission/knowledge-source-permission.js";
import { KnowledgeSourcePipeline } from "../pipeline/knowledge-source-pipeline.js";
import type { KnowledgeSourcePolicyRecord } from "../policy/knowledge-source-policy-record.js";
import { KnowledgeSourcePolicy } from "../policy/knowledge-source-policy.js";
import { KnowledgeSourceRegistryBucket } from "../registry/knowledge-source-registry-bucket.js";
import { KnowledgeSourceRegistry } from "../registry/knowledge-source-registry.js";
import { KnowledgeSourceResolver } from "../resolver/knowledge-source-resolver.js";
import { KnowledgeSourceSession } from "../session/knowledge-source-session.js";
import { KnowledgeSource } from "../source/knowledge-source.js";
import { KnowledgeSourceStateMachine } from "../state-machine/knowledge-source-state-machine.js";
import { KnowledgeSourceStatistics } from "../statistics/knowledge-source-statistics.js";
import { generateId } from "../utils/id.js";
import { KnowledgeSourceValidator } from "../validator/knowledge-source-validator.js";

export interface KnowledgeSourceManagerOptions {
  readonly events: KnowledgeSourceEvents;
  readonly config?: KnowledgeSourceManagerConfig;
}

/**
 * "KnowledgeSourceManager" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC
 * API") — the public façade. Composes Registry/Catalog/Resolver/Policy/Permission/
 * Factory/Validator/Metrics/Health/Monitor/Middleware behind one entry point, and
 * directly drives the Source Lifecycle State Machine around one
 * `KnowledgeSourcePipeline` call per registration — there is no separate mid-level
 * "verb"/orchestrator class beneath it (unlike `@aos/knowledge-provider`, which split
 * this responsibility between `KnowledgeProvider` and `KnowledgeProviderManager`; the
 * 005.7G prompt's Public API list has no equivalent second name, so this façade folds
 * both roles into one class — including the token-keyed `KnowledgeSourceExecution`
 * ledger: "Never scan collections. Lookup by token.").
 */
export class KnowledgeSourceManager {
  readonly registry = new KnowledgeSourceRegistry();
  readonly catalog = new KnowledgeSourceCatalog();
  readonly resolver: KnowledgeSourceResolver;
  readonly policy: KnowledgeSourcePolicy;
  readonly permission: KnowledgeSourcePermission;
  readonly factory = new KnowledgeSourceFactory();
  readonly validator = new KnowledgeSourceValidator();
  readonly session = new KnowledgeSourceSession();
  readonly statistics = new KnowledgeSourceStatistics();
  readonly middleware = new KnowledgeSourceMiddlewarePipeline();
  private readonly stateMachine = new KnowledgeSourceStateMachine();
  private readonly pipeline: KnowledgeSourcePipeline;
  private readonly metricsCollector = new KnowledgeSourceMetrics();
  private readonly monitor: KnowledgeSourceMonitor;
  private readonly executionsByToken = new Map<string, KnowledgeSourceExecution>();

  constructor(private readonly options: KnowledgeSourceManagerOptions) {
    this.resolver = new KnowledgeSourceResolver(this.catalog);
    this.policy = new KnowledgeSourcePolicy(this.registry);
    this.permission = new KnowledgeSourcePermission(this.registry);
    this.monitor = new KnowledgeSourceMonitor(this.metricsCollector, this.registry, this.catalog);
    this.pipeline = new KnowledgeSourcePipeline(
      this.validator,
      this.policy,
      this.permission,
      this.registry,
      this.catalog,
      this.metricsCollector,
      options.events,
      { providerResolver: options.config?.providerResolver },
    );
  }

  registerPolicy(policy: KnowledgeSourcePolicyRecord): KnowledgeSourcePolicyRecord {
    return this.policy.register(policy);
  }

  registerPermission(grant: KnowledgeSourcePermissionGrant): KnowledgeSourcePermissionGrant {
    return this.permission.register(grant);
  }

  use(middleware: SourceMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  /** Registers a new configured Source — drives Created -> Registered -> Configured -> Validated, then Enabled when `configuration.enabled`. */
  async create(
    metadata: KnowledgeSourceMetadataRecord,
    configuration: KnowledgeSourceConfigurationRecord,
    context: KnowledgeSourceContext,
  ): Promise<KnowledgeSource> {
    let execution = this.createExecution(metadata, configuration, context);
    this.executionsByToken.set(execution.instance.token, execution);
    this.statistics.recordRegistration(metadata.sourceCategory);
    await this.options.events.publishSourceEvent(KnowledgeSourceEventType.CREATED, context, {
      sourceId: metadata.sourceId,
    });

    await this.pipeline.run({ metadata, configuration, context });

    for (const to of [
      KnowledgeSourceState.REGISTERED,
      KnowledgeSourceState.CONFIGURED,
      KnowledgeSourceState.VALIDATED,
    ]) {
      execution = this.stateMachine.transition({ execution, to });
    }

    if (configuration.enabled) {
      execution = this.stateMachine.transition({ execution, to: KnowledgeSourceState.ENABLED });
      execution = {
        ...execution,
        instance: { ...execution.instance, enabledAt: new Date().toISOString() },
      };
      await this.options.events.publishSourceEvent(KnowledgeSourceEventType.ENABLED, context, {
        sourceId: metadata.sourceId,
      });
    }

    this.executionsByToken.set(execution.instance.token, execution);
    return new KnowledgeSource(execution);
  }

  async enable(token: string): Promise<KnowledgeSource> {
    return this.transitionAndPublish(
      token,
      KnowledgeSourceState.ENABLED,
      KnowledgeSourceEventType.ENABLED,
    );
  }

  async disable(token: string): Promise<KnowledgeSource> {
    return this.transitionAndPublish(
      token,
      KnowledgeSourceState.DISABLED,
      KnowledgeSourceEventType.DISABLED,
    );
  }

  async archive(token: string): Promise<KnowledgeSource> {
    return this.transitionAndPublish(
      token,
      KnowledgeSourceState.ARCHIVED,
      KnowledgeSourceEventType.ARCHIVED,
    );
  }

  async remove(token: string): Promise<KnowledgeSource> {
    const before = this.require(token);
    let execution = this.stateMachine.transition({
      execution: before,
      to: KnowledgeSourceState.DELETED,
    });
    this.executionsByToken.set(token, execution);
    await this.options.events.publishSourceEvent(
      KnowledgeSourceEventType.DELETED,
      execution.context,
      {
        sourceId: execution.metadata.sourceId,
      },
    );
    execution = this.stateMachine.transition({ execution, to: KnowledgeSourceState.DESTROYED });
    this.executionsByToken.set(token, execution);
    this.catalog.remove(execution.metadata.sourceId);
    this.registry.remove(KnowledgeSourceRegistryBucket.SOURCE, execution.metadata.sourceId);
    return new KnowledgeSource(execution);
  }

  getExecution(token: string): KnowledgeSourceExecution | undefined {
    return this.executionsByToken.get(token);
  }

  requireExecution(token: string): KnowledgeSourceExecution {
    return this.require(token);
  }

  get(token: string): KnowledgeSource | undefined {
    const execution = this.executionsByToken.get(token);
    return execution ? new KnowledgeSource(execution) : undefined;
  }

  require(token: string): KnowledgeSourceExecution {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      throw new SourceNotFoundException(
        `No Knowledge Source Instance is registered for Token "${token}"`,
      );
    }
    return execution;
  }

  list(tenantId?: string): readonly KnowledgeSource[] {
    const all = Array.from(this.executionsByToken.values());
    const filtered =
      tenantId === undefined
        ? all
        : all.filter((execution) => execution.instance.tenantId === tenantId);
    return filtered.map((execution) => new KnowledgeSource(execution));
  }

  count(): number {
    return this.executionsByToken.size;
  }

  health(): KnowledgeSourceHealthReport {
    return this.monitor.health.check();
  }

  metrics(): KnowledgeSourceMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): KnowledgeSourceDashboard {
    return this.monitor.sample();
  }

  private async transitionAndPublish(
    token: string,
    to: KnowledgeSourceState,
    eventType: KnowledgeSourceEventType,
  ): Promise<KnowledgeSource> {
    const before = this.require(token);
    const execution = this.stateMachine.transition({ execution: before, to });
    this.executionsByToken.set(token, execution);
    await this.options.events.publishSourceEvent(eventType, execution.context, {
      sourceId: execution.metadata.sourceId,
    });
    return new KnowledgeSource(execution);
  }

  private createExecution(
    metadata: KnowledgeSourceMetadataRecord,
    configuration: KnowledgeSourceConfigurationRecord,
    context: KnowledgeSourceContext,
  ): KnowledgeSourceExecution {
    const now = new Date().toISOString();
    const instance: KnowledgeSourceInstance = {
      id: generateId(),
      token: context.token,
      sourceId: metadata.sourceId,
      providerId: metadata.providerId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      state: KnowledgeSourceState.CREATED,
      createdAt: now,
      updatedAt: now,
    };
    return { instance, context, metadata, configuration, history: [] };
  }
}
