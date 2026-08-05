import { NodeState } from "../contracts/node-state.js";
import type { NodeType } from "../contracts/node-type.js";
import { generateId } from "../utils/id.js";

import type { NodeInstance } from "./node-instance.js";
import type { NodeMetadata } from "./node-metadata.js";

export interface CreateNodeInstanceInput {
  readonly workflowInstanceId: string;
  readonly nodeId: string;
  readonly type: NodeType;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly dependsOn?: readonly string[];
  readonly metadata?: NodeMetadata;
}

/** Builds a fresh `NodeInstance` in `NodeState.CREATED`, with a freshly generated `id`. */
export function createNodeInstance(input: CreateNodeInstanceInput): NodeInstance {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    workflowInstanceId: input.workflowInstanceId,
    nodeId: input.nodeId,
    type: input.type,
    status: NodeState.CREATED,
    config: { ...(input.config ?? {}) },
    dependsOn: input.dependsOn ? [...input.dependsOn] : undefined,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}
