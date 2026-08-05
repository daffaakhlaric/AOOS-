import { generateId } from "../utils/id.js";

import type { NodeExecution } from "./node-execution.js";

/** A point-in-time copy of a Node Instance's `NodeInstance` + `NodeContext` + `NodeHistory`. */
export interface NodeSnapshot {
  readonly id: string;
  readonly nodeInstanceId: string;
  readonly capturedAt: string;
  readonly execution: NodeExecution;
}

/** Captures a `NodeSnapshot` from the current `NodeExecution` — pure, no storage (no Snapshot Manager module is requested for this package, unlike `@aos/workflow-runtime`'s 005.6B). */
export function createNodeSnapshot(execution: NodeExecution): NodeSnapshot {
  return {
    id: generateId(),
    nodeInstanceId: execution.instance.id,
    capturedAt: new Date().toISOString(),
    execution,
  };
}
