import type { CreateKnowledgeGraphInput } from "../domain/knowledge-graph.js";
import { GraphEngine } from "../graph/graph-engine.js";

/** Constructs a brand-new, empty `GraphEngine` from a `CreateKnowledgeGraphInput`. */
export class GraphFactory {
  create(input: CreateKnowledgeGraphInput): GraphEngine {
    return GraphEngine.create(input);
  }
}
