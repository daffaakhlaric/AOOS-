import { wouldCreateCycle } from "../analytics/cycle-detection.js";
import type { ResolvedGraphConfiguration } from "../domain/graph-configuration.js";
import { CycleDetectedException } from "../errors/cycle-detected-exception.js";

import type { GraphOperationDescriptor } from "./graph-operation-descriptor.js";

/**
 * Stage 4 — Cycle Detection. Only runs when `descriptor.checkCycles` is true and a
 * `relationshipCandidate` targets an edge type in the resolved configuration's
 * `cycleCheckedEdgeTypes` (hierarchical/DAG-shaped types by default: `DependsOn`, `ChildOf`,
 * `ParentOf`, `Contains`). Rejects the edge with `CycleDetectedException` when the target node can
 * already reach the source node via existing edges of those types — i.e. adding it would close a
 * cycle. This is a real, load-bearing guard: it runs BEFORE the Execution stage commits the edge.
 */
export function runCycleDetectionStage<T>(
  descriptor: GraphOperationDescriptor<T>,
  configuration: ResolvedGraphConfiguration,
): void {
  const candidate = descriptor.relationshipCandidate;
  if (!candidate || !descriptor.engine || !descriptor.checkCycles) return;
  if (!configuration.cycleCheckedEdgeTypes.has(candidate.edgeType)) return;

  const wouldCycle = wouldCreateCycle(
    descriptor.engine,
    candidate.sourceNodeId,
    candidate.targetNodeId,
    configuration.cycleCheckedEdgeTypes,
  );
  if (wouldCycle) {
    throw new CycleDetectedException(
      candidate.sourceNodeId,
      candidate.targetNodeId,
      candidate.edgeType,
    );
  }
}
