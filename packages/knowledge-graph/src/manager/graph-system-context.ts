import type { IKnowledgeGraphEventPublisher } from "../contracts/i-knowledge-graph-event-publisher.js";
import { KnowledgeEdgeFactory } from "../edges/knowledge-edge-factory.js";
import { KnowledgeEdgeUpdater } from "../edges/knowledge-edge-updater.js";
import { GraphFactory } from "../factory/graph-factory.js";
import { GraphSnapshotFactory } from "../factory/graph-snapshot-factory.js";
import { KnowledgeGraphMetricsCollector } from "../metrics/knowledge-graph-metrics-collector.js";
import { KnowledgeGraphMonitor } from "../monitoring/knowledge-graph-monitor.js";
import { KnowledgeNodeFactory } from "../nodes/knowledge-node-factory.js";
import { KnowledgeNodeUpdater } from "../nodes/knowledge-node-updater.js";
import { GraphOperationPipeline } from "../pipeline/graph-operation-pipeline.js";
import { ConfigurationRegistry } from "../registry/configuration-registry.js";
import { EdgeRegistry } from "../registry/edge-registry.js";
import { GraphRegistry } from "../registry/graph-registry.js";
import { NodeRegistry } from "../registry/node-registry.js";
import { RelationshipRegistry } from "../registry/relationship-registry.js";
import { SnapshotRegistry } from "../registry/snapshot-registry.js";

/**
 * The shared dependency bundle every Manager is constructed with — the composition root
 * (`bootstrap/knowledge-graph-system.ts`) builds exactly one of these and hands it to all 5
 * Managers, so every Manager operates over the same Registries/Pipeline/Metrics/Monitor instances.
 */
export interface GraphSystemContext {
  readonly graphRegistry: GraphRegistry;
  readonly nodeRegistry: NodeRegistry;
  readonly edgeRegistry: EdgeRegistry;
  readonly relationshipRegistry: RelationshipRegistry;
  readonly snapshotRegistry: SnapshotRegistry;
  readonly configurationRegistry: ConfigurationRegistry;
  readonly graphFactory: GraphFactory;
  readonly nodeFactory: KnowledgeNodeFactory;
  readonly edgeFactory: KnowledgeEdgeFactory;
  readonly nodeUpdater: KnowledgeNodeUpdater;
  readonly edgeUpdater: KnowledgeEdgeUpdater;
  readonly snapshotFactory: GraphSnapshotFactory;
  readonly pipeline: GraphOperationPipeline;
  readonly eventPublisher: IKnowledgeGraphEventPublisher;
  readonly metricsCollector: KnowledgeGraphMetricsCollector;
  readonly monitor: KnowledgeGraphMonitor;
}

/** Builds a fresh `GraphSystemContext` with brand-new (non-shared) instances of every dependency. */
export function createGraphSystemContext(
  eventPublisher: IKnowledgeGraphEventPublisher,
  pipeline: GraphOperationPipeline = new GraphOperationPipeline(),
): GraphSystemContext {
  const graphRegistry = new GraphRegistry();
  const metricsCollector = new KnowledgeGraphMetricsCollector();
  return {
    graphRegistry,
    nodeRegistry: new NodeRegistry(),
    edgeRegistry: new EdgeRegistry(),
    relationshipRegistry: new RelationshipRegistry(),
    snapshotRegistry: new SnapshotRegistry(),
    configurationRegistry: new ConfigurationRegistry(),
    graphFactory: new GraphFactory(),
    nodeFactory: new KnowledgeNodeFactory(),
    edgeFactory: new KnowledgeEdgeFactory(),
    nodeUpdater: new KnowledgeNodeUpdater(),
    edgeUpdater: new KnowledgeEdgeUpdater(),
    snapshotFactory: new GraphSnapshotFactory(),
    pipeline,
    eventPublisher,
    metricsCollector,
    monitor: new KnowledgeGraphMonitor(graphRegistry, metricsCollector),
  };
}
