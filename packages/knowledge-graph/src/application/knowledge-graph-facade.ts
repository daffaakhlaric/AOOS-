import { ConfigurationService } from "../configuration/configuration-service.js";
import type { IKnowledgeGraphEventPublisher } from "../contracts/i-knowledge-graph-event-publisher.js";
import type { GraphConfiguration } from "../domain/graph-configuration.js";
import type { GraphMetrics } from "../domain/graph-metrics.js";
import { InMemoryEventPublisher } from "../events/in-memory-event-publisher.js";
import { AnalyticsManager } from "../manager/analytics-manager.js";
import {
  createGraphSystemContext,
  type GraphSystemContext,
} from "../manager/graph-system-context.js";
import { KnowledgeGraphManager } from "../manager/knowledge-graph-manager.js";
import { ReasoningManager } from "../manager/reasoning-manager.js";
import { RelationshipManager } from "../manager/relationship-manager.js";
import { TraversalManager } from "../manager/traversal-manager.js";
import type { PipelineMiddleware } from "../middleware/pipeline-middleware.js";
import { GraphOperationPipeline } from "../pipeline/graph-operation-pipeline.js";
import { DEFAULT_CONFIGURATION_KEY } from "../registry/configuration-registry.js";

export interface KnowledgeGraphFacadeOptions {
  /** System-wide default configuration, applied to every graph that doesn't override it. */
  readonly configuration?: GraphConfiguration;
  /** Event sink. Defaults to a fresh `InMemoryEventPublisher`. */
  readonly eventPublisher?: IKnowledgeGraphEventPublisher;
  /** Cross-cutting pipeline middleware (logging/timing/...), applied in order. */
  readonly middlewares?: readonly PipelineMiddleware[];
}

/**
 * "Facade only. Hide internal implementation." (spec, PUBLIC API). `KnowledgeGraph` is the single
 * entry point most consumers need: it wires one `GraphSystemContext` (registries, factories,
 * pipeline, metrics, monitor) and exposes the 5 Managers as named properties, so the internal
 * plumbing (Registry buckets, the 7-stage Pipeline, individual algorithm modules) never needs to
 * be imported directly by a host application.
 */
export class KnowledgeGraph {
  readonly graphs: KnowledgeGraphManager;
  readonly relationships: RelationshipManager;
  readonly traversal: TraversalManager;
  readonly analytics: AnalyticsManager;
  readonly reasoning: ReasoningManager;

  private readonly ctx: GraphSystemContext;

  constructor(options: KnowledgeGraphFacadeOptions = {}) {
    const eventPublisher = options.eventPublisher ?? new InMemoryEventPublisher();
    const pipeline = new GraphOperationPipeline(options.middlewares ?? []);
    this.ctx = createGraphSystemContext(eventPublisher, pipeline);

    const configurationService = new ConfigurationService();
    this.ctx.configurationRegistry.put(
      DEFAULT_CONFIGURATION_KEY,
      configurationService.resolve(options.configuration),
    );

    this.graphs = new KnowledgeGraphManager(this.ctx);
    this.relationships = new RelationshipManager(this.ctx, this.graphs);
    this.traversal = new TraversalManager(this.ctx, this.graphs);
    this.analytics = new AnalyticsManager(this.ctx);
    this.reasoning = new ReasoningManager(this.ctx);
  }

  /** Package-wide (cross-graph) metrics snapshot — the 8 Metrics from the specification. */
  metrics(): GraphMetrics {
    return this.ctx.metricsCollector.snapshot();
  }

  /** The 5 Monitoring dimensions — Health, Performance, Traversal Time, Memory Usage, Graph Size. */
  get monitor() {
    return this.ctx.monitor;
  }
}
