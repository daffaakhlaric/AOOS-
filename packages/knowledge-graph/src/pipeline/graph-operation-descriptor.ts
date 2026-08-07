import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import type { GraphEngine } from "../graph/graph-engine.js";

import type { GraphOperationType } from "./graph-operation-type.js";

/** The proposed edge a Connect/CreateEdge operation wants to add, as seen by the pipeline's guard stages. */
export interface RelationshipCandidate {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly edgeType: KnowledgeEdgeType;
}

/**
 * Everything `GraphOperationPipeline.execute` needs to run one Graph Operation through all 7
 * stages. Managers build one of these per call and let the pipeline enforce Validation,
 * Authorization, Relationship Validation, and Cycle Detection uniformly, instead of each manager
 * re-implementing those guards.
 */
export interface GraphOperationDescriptor<T> {
  readonly operation: GraphOperationType;
  readonly actor?: string;
  readonly graphId?: string;
  /** The graph the operation runs against, when applicable (absent for e.g. CreateGraph). */
  readonly engine?: GraphEngine;
  /** Validation stage: throws (typically `GraphValidationException`) on malformed input. */
  readonly validate: () => void;
  /** Present only for operations proposing a new edge (Connect / CreateEdge). */
  readonly relationshipCandidate?: RelationshipCandidate;
  /** Whether the Cycle Detection stage should run for this operation (true for Connect/CreateEdge). */
  readonly checkCycles?: boolean;
  /** Execution stage: performs the real operation and returns its result. */
  readonly execute: () => T;
  /** Metrics stage: records counters/gauges for the operation's outcome. */
  readonly recordMetrics?: (output: T) => void;
  /** Events stage: publishes domain events for the operation's outcome. */
  readonly emitEvents?: (output: T) => void;
}
