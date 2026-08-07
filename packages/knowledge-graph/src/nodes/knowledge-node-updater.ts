import type { KnowledgeNode, UpdateKnowledgeNodeInput } from "../domain/knowledge-node.js";
import { now } from "../utils/index.js";

/** Applies a partial `UpdateKnowledgeNodeInput` to an existing `KnowledgeNode`, returning a new record. */
export class KnowledgeNodeUpdater {
  apply(node: KnowledgeNode, input: UpdateKnowledgeNodeInput): KnowledgeNode {
    return {
      ...node,
      label: input.label ?? node.label,
      metadata: input.metadata ?? node.metadata,
      updatedAt: now(),
    };
  }
}
