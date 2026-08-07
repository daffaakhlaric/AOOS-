import type { KnowledgeEdge, UpdateKnowledgeEdgeInput } from "../domain/knowledge-edge.js";
import { GraphValidationException } from "../errors/graph-validation-exception.js";
import { now } from "../utils/index.js";

/** Applies a partial `UpdateKnowledgeEdgeInput` to an existing `KnowledgeEdge`, returning a new record. */
export class KnowledgeEdgeUpdater {
  apply(edge: KnowledgeEdge, input: UpdateKnowledgeEdgeInput): KnowledgeEdge {
    if (input.weight !== undefined && (!Number.isFinite(input.weight) || input.weight < 0)) {
      throw new GraphValidationException("Edge weight must be a finite number >= 0", { input });
    }
    return {
      ...edge,
      weight: input.weight ?? edge.weight,
      metadata: input.metadata ?? edge.metadata,
      updatedAt: now(),
    };
  }
}
