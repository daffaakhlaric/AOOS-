import type { KnowledgeEngine } from "@aos/knowledge-engine";
import type { KnowledgeIndexing } from "@aos/knowledge-indexing";

import type { KnowledgeRetrievalConfig } from "../config/knowledge-retrieval-config.js";
import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { IKnowledgeRankingProvider } from "../contracts/i-knowledge-ranking-provider.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeRankingStrategy } from "../domain/knowledge-ranking-strategy.js";
import type { KnowledgeRetrievalExecution } from "../domain/knowledge-retrieval-execution.js";
import type { KnowledgeRetrievalEvents } from "../events/knowledge-retrieval-events.js";
import { KnowledgeSearchFactory } from "../factory/knowledge-search-factory.js";
import type { KnowledgeRetrievalHealthReport } from "../health/i-health-check.js";
import { KnowledgeRetrievalManager } from "../manager/knowledge-retrieval-manager.js";
import type { KnowledgeRetrievalMetricsSnapshot } from "../metrics/i-knowledge-retrieval-metrics.js";
import { KnowledgeRetrievalMetrics } from "../metrics/knowledge-retrieval-metrics.js";
import type { KnowledgeRetrievalDashboard } from "../monitoring/knowledge-retrieval-monitor.js";
import { KnowledgeRetrievalMonitor } from "../monitoring/knowledge-retrieval-monitor.js";
import { KnowledgeSearchPipeline } from "../pipeline/knowledge-search-pipeline.js";
import { KnowledgeRankingEngine } from "../ranking/knowledge-ranking-engine.js";
import { KnowledgeResolver } from "../resolver/knowledge-resolver.js";
import { KnowledgeRetriever } from "../retriever/knowledge-retriever.js";
import { KnowledgeRetrievalStateMachine } from "../state-machine/knowledge-retrieval-state-machine.js";
import type { IKnowledgeSearchStrategy } from "../strategy/i-search-strategy.js";
import { KnowledgeSearchStrategy } from "../strategy/knowledge-search-strategy.js";
import { KnowledgeRetrievalValidator } from "../validator/knowledge-retrieval-validator.js";

export interface KnowledgeRetrievalOptions {
  readonly knowledgeEngine: KnowledgeEngine;
  readonly knowledgeIndexing: KnowledgeIndexing;
  readonly events: KnowledgeRetrievalEvents;
  readonly config?: KnowledgeRetrievalConfig;
}

/**
 * "Build a vendor-neutral Enterprise Retrieval Engine. Every future Agent retrieves
 * enterprise knowledge only through this package." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md)
 * — the public façade. Composes Manager/Retriever/Resolver/Search Strategy/Ranking
 * Engine/Factory/Validator/Metrics/Health/Monitor behind one entry point.
 */
export class KnowledgeRetrieval {
  readonly manager = new KnowledgeRetrievalManager();
  readonly factory = new KnowledgeSearchFactory();
  readonly validator = new KnowledgeRetrievalValidator();
  readonly resolver: KnowledgeResolver;
  readonly searchStrategy: KnowledgeSearchStrategy;
  readonly rankingEngine: KnowledgeRankingEngine;
  readonly retriever: KnowledgeRetriever;
  private readonly metricsCollector = new KnowledgeRetrievalMetrics();
  private readonly monitor: KnowledgeRetrievalMonitor;

  constructor(options: KnowledgeRetrievalOptions) {
    const engine = options.knowledgeEngine;
    this.resolver = new KnowledgeResolver(
      engine.repository,
      engine.relationshipEngine,
      engine.policyEngine,
      engine.permissionEngine,
      engine.versionEngine,
      engine.templateEngine,
      options.knowledgeIndexing.resolver,
    );
    this.searchStrategy = new KnowledgeSearchStrategy(this.manager.registry);
    this.rankingEngine = new KnowledgeRankingEngine(this.manager.registry);
    this.monitor = new KnowledgeRetrievalMonitor(this.metricsCollector, this.manager.registry);
    const pipeline = new KnowledgeSearchPipeline(
      this.validator,
      this.searchStrategy,
      this.rankingEngine,
      this.resolver,
      this.metricsCollector,
      {
        queryPermissionChecker: options.config?.queryPermissionChecker,
        queryPolicyChecker: options.config?.queryPolicyChecker,
        resultPermissionChecker: options.config?.resultPermissionChecker,
      },
    );
    this.retriever = new KnowledgeRetriever(
      new KnowledgeRetrievalStateMachine(),
      this.manager,
      pipeline,
      this.metricsCollector,
      options.events,
    );
  }

  registerSearchStrategy(strategy: IKnowledgeSearchStrategy): IKnowledgeSearchStrategy {
    return this.searchStrategy.register(strategy);
  }

  registerRankingProvider(
    strategy: KnowledgeRankingStrategy,
    provider: IKnowledgeRankingProvider,
  ): IKnowledgeRankingProvider {
    return this.rankingEngine.register(strategy, provider);
  }

  async search(
    query: KnowledgeQuery,
    context: KnowledgeQueryContext,
    rankingStrategy?: KnowledgeRankingStrategy,
  ): Promise<KnowledgeRetrievalExecution> {
    return this.retriever.retrieve({ query, context, rankingStrategy });
  }

  async cancel(token: string): Promise<KnowledgeRetrievalExecution> {
    return this.retriever.cancel(token);
  }

  getExecution(token: string): KnowledgeRetrievalExecution | undefined {
    return this.manager.get(token);
  }

  requireExecution(token: string): KnowledgeRetrievalExecution {
    return this.manager.require(token);
  }

  health(): KnowledgeRetrievalHealthReport {
    return this.monitor.health.check();
  }

  metrics(): KnowledgeRetrievalMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): KnowledgeRetrievalDashboard {
    return this.monitor.sample();
  }
}
