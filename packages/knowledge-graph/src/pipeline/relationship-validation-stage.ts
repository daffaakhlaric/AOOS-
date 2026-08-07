import type { ResolvedGraphConfiguration } from "../domain/graph-configuration.js";
import { INVERSE_EDGE_TYPE_PAIRS, SINGLE_TARGET_EDGE_TYPES } from "../edges/edge-type-semantics.js";
import { RelationshipValidationException } from "../errors/relationship-validation-exception.js";

import type { GraphOperationDescriptor } from "./graph-operation-descriptor.js";

/**
 * Stage 3 — Relationship Validation. Only runs when the descriptor proposes a new edge
 * (`relationshipCandidate` set) against a resolved `engine`. Enforces two edge-type semantics
 * (see `edges/edge-type-semantics.ts`):
 *  - Inverse-pair contradiction: rejects e.g. adding `ChildOf(A, B)` when `ParentOf(A, B)` already
 *    exists (the same pair already asserts the opposite relationship in the same direction).
 *  - Single-target cardinality: rejects a second outgoing edge of a `SINGLE_TARGET_EDGE_TYPES`
 *    type from the same source node (e.g. a node can be `VersionOf` at most one other node).
 * When `strictRelationshipValidation` is false, violations are silently tolerated (permissive mode).
 */
export function runRelationshipValidationStage<T>(
  descriptor: GraphOperationDescriptor<T>,
  configuration: ResolvedGraphConfiguration,
): void {
  const candidate = descriptor.relationshipCandidate;
  if (!candidate || !descriptor.engine) return;
  const engine = descriptor.engine;

  const inverseType = INVERSE_EDGE_TYPE_PAIRS.get(candidate.edgeType);
  if (inverseType) {
    const contradicted = engine
      .outgoingEdges(candidate.sourceNodeId)
      .some((edge) => edge.type === inverseType && edge.targetNodeId === candidate.targetNodeId);
    if (contradicted && configuration.strictRelationshipValidation) {
      throw new RelationshipValidationException(
        `Adding a ${candidate.edgeType} edge from ${candidate.sourceNodeId} to ${candidate.targetNodeId} contradicts an existing ${inverseType} edge between the same nodes`,
        { candidate, inverseType },
      );
    }
  }

  if (SINGLE_TARGET_EDGE_TYPES.has(candidate.edgeType)) {
    const alreadyHasTarget = engine
      .outgoingEdges(candidate.sourceNodeId)
      .some((edge) => edge.type === candidate.edgeType);
    if (alreadyHasTarget && configuration.strictRelationshipValidation) {
      throw new RelationshipValidationException(
        `Node ${candidate.sourceNodeId} already has an outgoing ${candidate.edgeType} edge (single-target cardinality)`,
        { candidate },
      );
    }
  }
}
