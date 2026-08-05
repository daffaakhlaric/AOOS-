import {
  NodeType as DefinitionNodeType,
  TransitionKind,
  WorkflowBuilder,
  type WorkflowDefinition,
} from "@aos/workflow-definition";

export function definitionFixture(): WorkflowDefinition {
  return WorkflowBuilder.create("sample-workflow", "1.0.0")
    .withDisplayName("Sample Workflow")
    .addNode({ id: "start", name: "Start", type: DefinitionNodeType.START })
    .addNode({
      id: "cap-1",
      name: "Do capability",
      type: DefinitionNodeType.CAPABILITY,
      capability: "crm.create",
    })
    .addNode({ id: "end", name: "End", type: DefinitionNodeType.END })
    .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "cap-1" })
    .addTransition({ id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "cap-1", toNodeId: "end" })
    .build();
}
