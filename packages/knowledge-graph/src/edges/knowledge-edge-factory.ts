import { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import type { CreateKnowledgeEdgeInput, KnowledgeEdge } from "../domain/knowledge-edge.js";
import { GraphValidationException } from "../errors/graph-validation-exception.js";
import { generateId, now } from "../utils/index.js";

/** Constructs well-formed `KnowledgeEdge` records, assigning defaults for id/weight/timestamps. */
export class KnowledgeEdgeFactory {
  create(input: CreateKnowledgeEdgeInput): KnowledgeEdge {
    if (!input.sourceNodeId || !input.targetNodeId) {
      throw new GraphValidationException("Edge requires both sourceNodeId and targetNodeId", {
        input,
      });
    }
    if (input.sourceNodeId === input.targetNodeId) {
      throw new GraphValidationException("Edge sourceNodeId and targetNodeId must differ", {
        input,
      });
    }
    if (input.type === KnowledgeEdgeType.Custom && !input.customTypeLabel) {
      throw new GraphValidationException("customTypeLabel is required when edge type is Custom", {
        input,
      });
    }
    if (input.weight !== undefined && (!Number.isFinite(input.weight) || input.weight < 0)) {
      throw new GraphValidationException("Edge weight must be a finite number >= 0", { input });
    }
    const timestamp = now();
    return {
      id: input.id ?? generateId("edge"),
      type: input.type,
      customTypeLabel: input.customTypeLabel,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      weight: input.weight ?? 1,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
