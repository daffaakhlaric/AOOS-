import type { Node, Transition, WorkflowDefinition } from "@aos/workflow-definition";

/** Structural-only lookups against a `WorkflowDefinition`'s Node/Transition graph — no Expression evaluation, no execution. */
export interface IWorkflowResolver {
  resolveStartNode(definition: WorkflowDefinition): Node;
  resolveEndNodes(definition: WorkflowDefinition): readonly Node[];
  resolveNode(definition: WorkflowDefinition, nodeId: string): Node;
  resolveOutgoingTransitions(definition: WorkflowDefinition, nodeId: string): readonly Transition[];
}
