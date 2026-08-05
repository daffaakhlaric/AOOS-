import { NodeType } from "../../src/contracts/node-type.js";
import { TenantScope } from "../../src/contracts/tenant-scope.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import type { Node } from "../../src/nodes/node.js";
import type { WorkflowDefinition } from "../../src/schemas/workflow-definition.js";
import type { Transition } from "../../src/transitions/transition.js";

/** A minimal, structurally-valid Workflow Definition (Start → Task → End) reused across parser/serializer/validator/builder/registry tests. */
export function workflowFixture(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const nodes: Node[] = [
    { id: "start", name: "Start", type: NodeType.START },
    { id: "task-1", name: "Do work", type: NodeType.TASK },
    { id: "end", name: "End", type: NodeType.END },
  ];
  const transitions: Transition[] = [
    { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "task-1" },
    { id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "task-1", toNodeId: "end" },
  ];

  return {
    id: "sample-workflow",
    version: "1.0.0",
    tenantScope: TenantScope.GLOBAL,
    nodes,
    transitions,
    ...overrides,
  };
}
