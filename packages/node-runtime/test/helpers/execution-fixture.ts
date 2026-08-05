import { createNodeContext } from "../../src/context/create-node-context.js";
import { NODE_STATE_TRANSITIONS, NodeState } from "../../src/contracts/node-state.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { createNodeInstance } from "../../src/instance/create-node-instance.js";
import type { NodeExecution } from "../../src/instance/node-execution.js";
import { NodeRegistry } from "../../src/registry/node-registry.js";

const registry = new NodeRegistry();

export function executionFixture(
  overrides: {
    readonly type?: NodeType;
    readonly status?: NodeState;
    readonly config?: Readonly<Record<string, unknown>>;
  } = {},
): NodeExecution {
  const type = overrides.type ?? NodeType.CUSTOM;
  const manifest = registry.get(type);
  if (!manifest) {
    throw new Error(`Unknown fixture NodeType "${type}"`);
  }
  const instance = createNodeInstance({
    workflowInstanceId: "wf-instance-1",
    nodeId: "node-1",
    type,
    config: overrides.config,
  });
  const context = createNodeContext({
    workflowInstanceId: "wf-instance-1",
    nodeId: "node-1",
    correlationId: "corr-1",
  });
  const status = overrides.status ?? NodeState.CREATED;
  return {
    manifest,
    instance: { ...instance, status },
    context,
    history: [],
  };
}

/** Every entry of `NODE_STATE_TRANSITIONS` re-exported for tests that want to assert against the authoritative table without importing `contracts/` directly. */
export const ALL_NODE_STATES = Object.keys(NODE_STATE_TRANSITIONS) as NodeState[];
