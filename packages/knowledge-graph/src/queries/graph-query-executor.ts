import {
  calculateGraphStatistics,
  computeAverageDegree,
  detectCycles,
  findConnectedComponents,
} from "../analytics/index.js";
import { GraphValidationException } from "../errors/graph-validation-exception.js";
import type { GraphEngine } from "../graph/graph-engine.js";
import { findDependencies, findDependents } from "../reasoning/index.js";
import { RelationshipService } from "../relationships/relationship-service.js";
import { breadthFirstSearch, depthFirstSearch, shortestPath } from "../traversal/index.js";

import type { GraphQuery } from "./graph-query.js";

const relationshipService = new RelationshipService();

/**
 * Dispatches a `GraphQuery` against a `GraphEngine`, routing to the matching subsystem
 * (filter/search over nodes, traversal algorithms, shortest path, relationship listings,
 * dependency reasoning, or analytics). Returns `unknown` — callers pattern-match on `query.kind`
 * to narrow the expected result shape at the call site.
 */
export function executeGraphQuery(engine: GraphEngine, query: GraphQuery): unknown {
  switch (query.kind) {
    case "Filter":
      return engine.listNodes().filter((node) => {
        const matchesNodeType = query.nodeType === undefined || node.type === query.nodeType;
        const matchesEdgeType =
          query.edgeType === undefined ||
          engine.outgoingEdges(node.id).some((edge) => edge.type === query.edgeType) ||
          engine.incomingEdges(node.id).some((edge) => edge.type === query.edgeType);
        return matchesNodeType && matchesEdgeType;
      });

    case "Search":
      return engine
        .listNodes()
        .filter((node) => node.label.toLowerCase().includes(query.text.toLowerCase()));

    case "TraversalQuery":
      return query.algorithm === "bfs"
        ? breadthFirstSearch(engine, query.startNodeId, {
            edgeTypes: query.edgeTypes,
            maxDepth: query.maxDepth,
          })
        : depthFirstSearch(engine, query.startNodeId, {
            edgeTypes: query.edgeTypes,
            maxDepth: query.maxDepth,
          });

    case "PathQuery":
      return shortestPath(engine, query.startNodeId, query.endNodeId);

    case "RelationshipQuery":
      if (query.nodeId) {
        return relationshipService.listRelationshipsForNode(engine, query.nodeId);
      }
      if (query.edgeType) {
        return relationshipService.listRelationshipsByType(engine, query.edgeType);
      }
      throw new GraphValidationException("RelationshipQuery requires nodeId or edgeType", {
        query,
      });

    case "DependencyQuery":
      return query.direction === "dependencies"
        ? findDependencies(engine, query.nodeId)
        : findDependents(engine, query.nodeId);

    case "AnalyticsQuery":
      switch (query.metric) {
        case "statistics":
          return calculateGraphStatistics(engine);
        case "connectedComponents":
          return findConnectedComponents(engine);
        case "cycles":
          return detectCycles(engine);
        case "averageDegree":
          return computeAverageDegree(engine);
        default:
          throw new GraphValidationException("Unknown AnalyticsQuery metric", { query });
      }

    default:
      throw new GraphValidationException("Unknown GraphQuery kind", { query });
  }
}
