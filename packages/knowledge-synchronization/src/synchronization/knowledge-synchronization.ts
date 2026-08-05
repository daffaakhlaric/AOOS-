import type { KnowledgeEngine } from "@aos/knowledge-engine";
import type { KnowledgeIndexing } from "@aos/knowledge-indexing";
import type { KnowledgeRetrieval } from "@aos/knowledge-retrieval";

import type { KnowledgeSynchronizationConfig } from "../config/knowledge-synchronization-config.js";
import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { IKnowledgeSynchronizationConflictResolver } from "../contracts/i-knowledge-synchronization-conflict-resolver.js";
import type { IKnowledgeSynchronizationProvider } from "../contracts/i-knowledge-synchronization-provider.js";
import type { KnowledgeConflictResolutionStrategy } from "../domain/knowledge-conflict-resolution-strategy.js";
import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";
import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";
import type { KnowledgeSynchronizationEvents } from "../events/knowledge-synchronization-events.js";
import { KnowledgeSynchronizationFactory } from "../factory/knowledge-synchronization-factory.js";
import type { KnowledgeSynchronizationHealthReport } from "../health/i-health-check.js";
import { KnowledgeSynchronizationLifecycle } from "../lifecycle/knowledge-synchronization-lifecycle.js";
import { KnowledgeSynchronizationManager } from "../manager/knowledge-synchronization-manager.js";
import type { KnowledgeSynchronizationMetricsSnapshot } from "../metrics/i-knowledge-synchronization-metrics.js";
import { KnowledgeSynchronizationMetrics } from "../metrics/knowledge-synchronization-metrics.js";
import {
  KnowledgeSynchronizationMiddlewarePipeline,
  type SynchronizationMiddleware,
} from "../middleware/knowledge-synchronization-middleware.js";
import type { KnowledgeSynchronizationDashboard } from "../monitoring/knowledge-synchronization-monitor.js";
import { KnowledgeSynchronizationMonitor } from "../monitoring/knowledge-synchronization-monitor.js";
import { KnowledgeSynchronizationPipeline } from "../pipeline/knowledge-synchronization-pipeline.js";
import type { KnowledgeSynchronizationPolicyRecord } from "../policy/knowledge-synchronization-policy-record.js";
import { KnowledgeSynchronizationPolicy } from "../policy/knowledge-synchronization-policy.js";
import { KnowledgeSynchronizationRegistryBucket } from "../registry/knowledge-synchronization-registry-bucket.js";
import { KnowledgeSynchronizationResolver } from "../resolver/knowledge-synchronization-resolver.js";
import { KnowledgeSynchronizationStateMachine } from "../state-machine/knowledge-synchronization-state-machine.js";
import {
  KnowledgeSynchronizer,
  type SynchronizeInput,
} from "../synchronizer/knowledge-synchronizer.js";
import { KnowledgeSynchronizationValidator } from "../validator/knowledge-synchronization-validator.js";

export interface KnowledgeSynchronizationOptions {
  readonly knowledgeEngine: KnowledgeEngine;
  readonly knowledgeIndexing: KnowledgeIndexing;
  readonly knowledgeRetrieval: KnowledgeRetrieval;
  readonly events: KnowledgeSynchronizationEvents;
  readonly config?: KnowledgeSynchronizationConfig;
}

/**
 * "Build a vendor-neutral Enterprise Knowledge Synchronization Engine. Every external
 * knowledge source synchronizes through this package." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md)
 * — the public façade. Composes Manager/Synchronizer/Resolver/Policy/Factory/Validator/
 * Metrics/Health/Monitor/Middleware behind one entry point. Reads through
 * `@aos/knowledge-engine`/`@aos/knowledge-indexing`/`@aos/knowledge-retrieval` — never
 * writes to any of them, and never implements OAuth, API clients, a Connector SDK, an
 * LLM, AI, retrieval, indexing, or memory itself.
 */
export class KnowledgeSynchronization {
  /**
   * Read-only references to the completed platform layers this package bridges to
   * external knowledge sources — held here (never invoked by this package itself) so a
   * future Provider (005.7F) resolved through `registerProvider()` can read platform
   * state without this package performing any Retrieval/Indexing/Engine write itself.
   */
  readonly knowledgeEngine: KnowledgeEngine;
  readonly knowledgeIndexing: KnowledgeIndexing;
  readonly knowledgeRetrieval: KnowledgeRetrieval;
  readonly manager: KnowledgeSynchronizationManager;
  readonly factory = new KnowledgeSynchronizationFactory();
  readonly validator = new KnowledgeSynchronizationValidator();
  readonly lifecycle = new KnowledgeSynchronizationLifecycle();
  readonly resolver: KnowledgeSynchronizationResolver;
  readonly policy: KnowledgeSynchronizationPolicy;
  readonly synchronizer: KnowledgeSynchronizer;
  readonly middleware = new KnowledgeSynchronizationMiddlewarePipeline();
  private readonly metricsCollector = new KnowledgeSynchronizationMetrics();
  private readonly monitor: KnowledgeSynchronizationMonitor;

  constructor(options: KnowledgeSynchronizationOptions) {
    this.knowledgeEngine = options.knowledgeEngine;
    this.knowledgeIndexing = options.knowledgeIndexing;
    this.knowledgeRetrieval = options.knowledgeRetrieval;
    this.manager = new KnowledgeSynchronizationManager(options.config?.externalScheduler);
    this.resolver = new KnowledgeSynchronizationResolver(
      this.manager.registry,
      options.config?.changeDetector,
    );
    this.policy = new KnowledgeSynchronizationPolicy(this.manager.registry);
    this.monitor = new KnowledgeSynchronizationMonitor(
      this.metricsCollector,
      this.manager.registry,
    );
    const pipeline = new KnowledgeSynchronizationPipeline(
      this.validator,
      this.policy,
      this.resolver,
      this.metricsCollector,
      options.events,
      {
        permissionChecker: options.config?.permissionChecker,
        committer: options.config?.committer,
      },
    );
    this.synchronizer = new KnowledgeSynchronizer(
      new KnowledgeSynchronizationStateMachine(),
      this.manager,
      pipeline,
      this.metricsCollector,
      options.events,
      options.config?.retryStrategy,
    );
  }

  registerProvider(provider: IKnowledgeSynchronizationProvider): IKnowledgeSynchronizationProvider {
    return this.manager.registry.replace(KnowledgeSynchronizationRegistryBucket.PROVIDER, provider);
  }

  registerPolicy(
    policy: KnowledgeSynchronizationPolicyRecord,
  ): KnowledgeSynchronizationPolicyRecord {
    return this.policy.register(policy);
  }

  registerConflictResolver(
    resolver: IKnowledgeSynchronizationConflictResolver,
  ): IKnowledgeSynchronizationConflictResolver {
    return this.policy.registerConflictResolver(resolver);
  }

  use(middleware: SynchronizationMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  async synchronize(
    job: KnowledgeSynchronizationJob,
    context: KnowledgeSynchronizationContext,
    conflictStrategy?: KnowledgeConflictResolutionStrategy,
  ): Promise<KnowledgeSynchronizationExecution> {
    const execution = await this.synchronizer.synchronize({ job, context, conflictStrategy });
    await this.middleware.run(execution);
    return execution;
  }

  async retry(token: string): Promise<KnowledgeSynchronizationExecution> {
    return this.synchronizer.retry(token);
  }

  async cancel(token: string): Promise<KnowledgeSynchronizationExecution> {
    return this.synchronizer.cancel(token);
  }

  async destroy(token: string): Promise<KnowledgeSynchronizationExecution> {
    return this.synchronizer.destroy(token);
  }

  getExecution(token: string): KnowledgeSynchronizationExecution | undefined {
    return this.manager.get(token);
  }

  requireExecution(token: string): KnowledgeSynchronizationExecution {
    return this.manager.require(token);
  }

  health(): KnowledgeSynchronizationHealthReport {
    return this.monitor.health.check();
  }

  metrics(): KnowledgeSynchronizationMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): KnowledgeSynchronizationDashboard {
    return this.monitor.sample();
  }
}

export type { SynchronizeInput };
