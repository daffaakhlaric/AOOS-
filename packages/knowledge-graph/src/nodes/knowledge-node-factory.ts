import { KnowledgeNodeType } from "../domain/knowledge-node-type.js";
import type { CreateKnowledgeNodeInput, KnowledgeNode } from "../domain/knowledge-node.js";
import { GraphValidationException } from "../errors/graph-validation-exception.js";
import { generateId, now } from "../utils/index.js";

/** Constructs well-formed `KnowledgeNode` records, assigning defaults for id/metadata/timestamps. */
export class KnowledgeNodeFactory {
  create(input: CreateKnowledgeNodeInput): KnowledgeNode {
    if (!input.label || input.label.trim().length === 0) {
      throw new GraphValidationException("Node label must be a non-empty string", { input });
    }
    if (input.type === KnowledgeNodeType.Custom && !input.customTypeLabel) {
      throw new GraphValidationException("customTypeLabel is required when node type is Custom", {
        input,
      });
    }
    const timestamp = now();
    return {
      id: input.id ?? generateId("node"),
      type: input.type,
      customTypeLabel: input.customTypeLabel,
      label: input.label,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
