import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown by the pipeline's Cycle Detection stage when a proposed edge would introduce a cycle. */
export class CycleDetectedException extends KnowledgeGraphException {
  constructor(sourceNodeId: string, targetNodeId: string, edgeType: string) {
    super(
      `Adding a ${edgeType} edge from ${sourceNodeId} to ${targetNodeId} would introduce a cycle`,
      { code: "CYCLE_DETECTED", context: { sourceNodeId, targetNodeId, edgeType } },
    );
  }
}
