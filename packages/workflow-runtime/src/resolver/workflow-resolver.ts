import {
  NodeType,
  type Node,
  type Transition,
  type WorkflowDefinition,
} from "@aos/workflow-definition";

import { NodeNotFoundException } from "../errors/node-not-found-exception.js";

import type { IWorkflowResolver } from "./i-workflow-resolver.js";

export class WorkflowResolver implements IWorkflowResolver {
  resolveStartNode(definition: WorkflowDefinition): Node {
    const start = definition.nodes.find((node) => node.type === NodeType.START);
    if (!start) {
      throw new NodeNotFoundException(`Workflow Definition "${definition.id}" has no Start Node`);
    }
    return start;
  }

  resolveEndNodes(definition: WorkflowDefinition): readonly Node[] {
    return definition.nodes.filter((node) => node.type === NodeType.END);
  }

  resolveNode(definition: WorkflowDefinition, nodeId: string): Node {
    const node = definition.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      throw new NodeNotFoundException(
        `Node "${nodeId}" not found in Workflow Definition "${definition.id}"`,
      );
    }
    return node;
  }

  resolveOutgoingTransitions(
    definition: WorkflowDefinition,
    nodeId: string,
  ): readonly Transition[] {
    return (definition.transitions ?? []).filter((transition) => transition.fromNodeId === nodeId);
  }
}
