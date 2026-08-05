import {
  NodeType,
  TransitionKind,
  WorkflowBuilder,
  type WorkflowDefinition,
} from "@aos/workflow-definition";

export function definitionFixture(
  overrides: { readonly id?: string; readonly version?: string } = {},
): WorkflowDefinition {
  return WorkflowBuilder.create(overrides.id ?? "sample-workflow", overrides.version ?? "1.0.0")
    .withDisplayName("Sample Workflow")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({ id: "task-1", name: "Do work", type: NodeType.TASK })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({
      id: "t-1",
      kind: TransitionKind.NEXT,
      fromNodeId: "start",
      toNodeId: "task-1",
    })
    .addTransition({ id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "task-1", toNodeId: "end" })
    .build();
}
