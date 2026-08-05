import type { KnowledgeProviderConfig } from "../config/knowledge-provider-config.js";
import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";
import type { IKnowledgeProvider } from "../contracts/i-knowledge-provider.js";
import type { KnowledgeProviderExecution } from "../domain/knowledge-provider-execution.js";
import type { KnowledgeProviderInstance } from "../domain/knowledge-provider-instance.js";
import { KnowledgeProviderState } from "../domain/knowledge-provider-state.js";
import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";
import { KnowledgeProviderEventType } from "../events/knowledge-provider-event-type.js";
import type { KnowledgeProviderEvents } from "../events/knowledge-provider-events.js";
import { KnowledgeProviderFactory } from "../factory/knowledge-provider-factory.js";
import type { KnowledgeProviderHealthReport } from "../health/i-health-check.js";
import { KnowledgeProviderManager } from "../manager/knowledge-provider-manager.js";
import type { KnowledgeProviderMetricsSnapshot } from "../metrics/i-knowledge-provider-metrics.js";
import { KnowledgeProviderMetrics } from "../metrics/knowledge-provider-metrics.js";
import {
  KnowledgeProviderMiddlewarePipeline,
  type ProviderMiddleware,
} from "../middleware/knowledge-provider-middleware.js";
import type { KnowledgeProviderDashboard } from "../monitoring/knowledge-provider-monitor.js";
import { KnowledgeProviderMonitor } from "../monitoring/knowledge-provider-monitor.js";
import { KnowledgeProviderPipeline } from "../pipeline/knowledge-provider-pipeline.js";
import type { KnowledgeProviderPolicyRecord } from "../policy/knowledge-provider-policy-record.js";
import { KnowledgeProviderPolicy } from "../policy/knowledge-provider-policy.js";
import { KnowledgeProviderRegistryBucket } from "../registry/knowledge-provider-registry-bucket.js";
import { KnowledgeProviderResolver } from "../resolver/knowledge-provider-resolver.js";
import { KnowledgeProviderStateMachine } from "../state-machine/knowledge-provider-state-machine.js";
import { generateId } from "../utils/id.js";
import { KnowledgeProviderValidator } from "../validator/knowledge-provider-validator.js";

export interface KnowledgeProviderOptions {
  readonly events: KnowledgeProviderEvents;
  readonly config?: KnowledgeProviderConfig;
}

/**
 * "Build a universal Enterprise Knowledge Provider framework ... Every external system
 * must implement a Knowledge Provider." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — the
 * public façade. Composes Manager/Resolver/Policy/Factory/Validator/Metrics/Health/
 * Monitor/Middleware behind one entry point, driving the Provider Lifecycle State
 * Machine directly around one Pipeline call per registration.
 */
export class KnowledgeProvider {
  readonly manager = new KnowledgeProviderManager();
  readonly factory = new KnowledgeProviderFactory();
  readonly validator = new KnowledgeProviderValidator();
  readonly resolver: KnowledgeProviderResolver;
  readonly policy: KnowledgeProviderPolicy;
  readonly middleware = new KnowledgeProviderMiddlewarePipeline();
  private readonly stateMachine = new KnowledgeProviderStateMachine();
  private readonly pipeline: KnowledgeProviderPipeline;
  private readonly metricsCollector = new KnowledgeProviderMetrics();
  private readonly monitor: KnowledgeProviderMonitor;

  constructor(private readonly options: KnowledgeProviderOptions) {
    this.resolver = new KnowledgeProviderResolver(this.manager.registry);
    this.policy = new KnowledgeProviderPolicy(this.manager.registry);
    this.monitor = new KnowledgeProviderMonitor(this.metricsCollector, this.manager.registry);
    this.pipeline = new KnowledgeProviderPipeline(
      this.validator,
      this.policy,
      this.resolver,
      this.manager.registry,
      this.metricsCollector,
      options.events,
      { permissionChecker: options.config?.permissionChecker },
    );
  }

  registerPolicy(policy: KnowledgeProviderPolicyRecord): KnowledgeProviderPolicyRecord {
    return this.policy.register(policy);
  }

  use(middleware: ProviderMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  async register(
    provider: IKnowledgeProvider,
    metadata: ProviderMetadataRecord,
    context: KnowledgeProviderContext,
  ): Promise<KnowledgeProviderExecution> {
    this.manager.registry.replace(KnowledgeProviderRegistryBucket.PROVIDER, provider);
    this.metricsCollector.recordProviderRegistered(metadata.providerId);
    this.manager.statistics.recordRegistration(metadata.providerCategory);

    let execution = this.createExecution(metadata, context);
    this.manager.register(execution);
    await this.options.events.publishProviderEvent(KnowledgeProviderEventType.REGISTERED, context, {
      providerId: metadata.providerId,
    });

    try {
      await this.pipeline.run({ metadata, context });

      for (const to of [
        KnowledgeProviderState.VALIDATED,
        KnowledgeProviderState.CONFIGURED,
        KnowledgeProviderState.CONNECTED,
      ]) {
        execution = this.stateMachine.transition({ execution, to });
      }
      await this.options.events.publishProviderEvent(
        KnowledgeProviderEventType.CONNECTED,
        context,
        {
          providerId: metadata.providerId,
        },
      );
      execution = this.stateMachine.transition({ execution, to: KnowledgeProviderState.READY });
      const now = new Date().toISOString();
      execution = {
        ...execution,
        instance: { ...execution.instance, connectedAt: now, readyAt: now },
      };
      this.manager.update(execution);
      this.metricsCollector.setProviderCount(
        this.manager.registry.count(KnowledgeProviderRegistryBucket.PROVIDER),
      );
      return execution;
    } catch (error) {
      execution = this.stateMachine.transition({
        execution,
        to: KnowledgeProviderState.FAILED,
        reason: error instanceof Error ? error.message : String(error),
      });
      this.manager.update(execution);
      throw error;
    }
  }

  async disable(token: string): Promise<KnowledgeProviderExecution> {
    return this.transitionAndPublish(
      token,
      KnowledgeProviderState.DISABLED,
      KnowledgeProviderEventType.DISABLED,
    );
  }

  async enable(token: string): Promise<KnowledgeProviderExecution> {
    return this.transitionAndPublish(
      token,
      KnowledgeProviderState.READY,
      KnowledgeProviderEventType.ENABLED,
    );
  }

  async disconnect(token: string): Promise<KnowledgeProviderExecution> {
    return this.transitionAndPublish(
      token,
      KnowledgeProviderState.DISCONNECTED,
      KnowledgeProviderEventType.DISCONNECTED,
    );
  }

  async reconnect(token: string): Promise<KnowledgeProviderExecution> {
    return this.transitionAndPublish(
      token,
      KnowledgeProviderState.CONNECTED,
      KnowledgeProviderEventType.CONNECTED,
    );
  }

  async destroy(token: string): Promise<KnowledgeProviderExecution> {
    const before = this.manager.require(token);
    const execution = this.stateMachine.transition({
      execution: before,
      to: KnowledgeProviderState.DESTROYED,
    });
    this.manager.update(execution);
    this.manager.unregister(token);
    return execution;
  }

  getExecution(token: string): KnowledgeProviderExecution | undefined {
    return this.manager.get(token);
  }

  requireExecution(token: string): KnowledgeProviderExecution {
    return this.manager.require(token);
  }

  health(): KnowledgeProviderHealthReport {
    this.metricsCollector.recordHealthCheck();
    return this.monitor.health.check();
  }

  metrics(): KnowledgeProviderMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): KnowledgeProviderDashboard {
    return this.monitor.sample();
  }

  private async transitionAndPublish(
    token: string,
    to: KnowledgeProviderState,
    eventType: KnowledgeProviderEventType,
  ): Promise<KnowledgeProviderExecution> {
    const before = this.manager.require(token);
    const execution = this.stateMachine.transition({ execution: before, to });
    this.manager.update(execution);
    await this.options.events.publishProviderEvent(eventType, execution.context, {
      providerId: execution.metadata.providerId,
    });
    return execution;
  }

  private createExecution(
    metadata: ProviderMetadataRecord,
    context: KnowledgeProviderContext,
  ): KnowledgeProviderExecution {
    const now = new Date().toISOString();
    const instance: KnowledgeProviderInstance = {
      id: generateId(),
      token: context.token,
      providerId: metadata.providerId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      state: KnowledgeProviderState.REGISTERED,
      createdAt: now,
      updatedAt: now,
    };
    return { instance, context, metadata, history: [] };
  }
}
