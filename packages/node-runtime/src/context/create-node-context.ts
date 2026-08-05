import { ExecutionMode } from "../contracts/execution-mode.js";
import { generateId } from "../utils/id.js";

import type { NodeContext } from "./node-context.js";

export interface CreateNodeContextInput {
  readonly tenantId?: string;
  readonly workflowInstanceId: string;
  readonly nodeId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly variables?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly executionMode?: ExecutionMode;
}

/** Builds a fresh `NodeContext` with a generated `executionId` — the starting point `runtime/node-runtime.ts#createInstance()` hands to a new Node Instance. */
export function createNodeContext(input: CreateNodeContextInput): NodeContext {
  return {
    tenantId: input.tenantId,
    workflowInstanceId: input.workflowInstanceId,
    nodeId: input.nodeId,
    executionId: generateId(),
    traceId: input.traceId,
    correlationId: input.correlationId ?? generateId(),
    input: input.input ? { ...input.input } : undefined,
    output: undefined,
    variables: { ...(input.variables ?? {}) },
    metadata: input.metadata ? { ...input.metadata } : undefined,
    executionMode: input.executionMode ?? ExecutionMode.NORMAL,
  };
}
