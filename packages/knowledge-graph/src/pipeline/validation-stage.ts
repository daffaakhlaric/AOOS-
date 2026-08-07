import { isKnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import { GraphValidationException } from "../errors/graph-validation-exception.js";

import type { GraphOperationDescriptor } from "./graph-operation-descriptor.js";

/**
 * Stage 1 — Validation. Runs the operation-specific `descriptor.validate()` callback (which
 * throws on malformed input), plus a generic structural check that any proposed
 * `relationshipCandidate` names a real `KnowledgeEdgeType`.
 */
export function runValidationStage<T>(descriptor: GraphOperationDescriptor<T>): void {
  descriptor.validate();
  const candidate = descriptor.relationshipCandidate;
  if (candidate && !isKnowledgeEdgeType(candidate.edgeType)) {
    throw new GraphValidationException(`Unknown edge type: ${String(candidate.edgeType)}`, {
      candidate,
    });
  }
}
