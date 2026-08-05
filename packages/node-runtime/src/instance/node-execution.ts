import type { NodeContext } from "../context/node-context.js";
import type { NodeManifest } from "../contracts/node-manifest.js";

import type { NodeHistory } from "./node-history.js";
import type { NodeInstance } from "./node-instance.js";

/**
 * The live, in-memory aggregate the Runtime operates on — a `NodeInstance` (the
 * persistent envelope), its `NodeContext` (variables/mode), the ordered `NodeHistory` of
 * every state transition, and the `NodeManifest` it was created from (read-only
 * reference, never mutated here). `NodeContext`'s own field list
 * (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "NODE CONTEXT") does not include
 * History, so it lives here at the aggregate level instead.
 */
export interface NodeExecution {
  readonly manifest: NodeManifest;
  readonly instance: NodeInstance;
  readonly context: NodeContext;
  readonly history: NodeHistory;
}

/** Returns a new `NodeExecution` with `instance`/`context`/`history` replaced — the manifest never changes across a Node Instance's lifetime. */
export function withNodeExecutionState(
  execution: NodeExecution,
  patch: {
    readonly instance?: NodeInstance;
    readonly context?: NodeContext;
    readonly history?: NodeHistory;
  },
): NodeExecution {
  return {
    manifest: execution.manifest,
    instance: patch.instance ?? execution.instance,
    context: patch.context ?? execution.context,
    history: patch.history ?? execution.history,
  };
}
