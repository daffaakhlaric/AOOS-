import type { Node, WorkflowDefinition } from "@aos/workflow-definition";

import type { NodeManifest } from "../contracts/node-manifest.js";
import type { NodeType } from "../contracts/node-type.js";
import { NodeNotFoundException } from "../errors/node-not-found-exception.js";
import type { INodeRegistry } from "../registry/i-node-registry.js";

import type { INodeResolver } from "./i-node-resolver.js";

export class NodeResolver implements INodeResolver {
  constructor(private readonly registry: INodeRegistry) {}

  resolveType(type: NodeType): NodeManifest {
    const manifest = this.registry.get(type);
    if (!manifest) {
      throw new NodeNotFoundException(`Node Type "${type}" is not registered`);
    }
    return manifest;
  }

  resolveVersion(type: NodeType): string {
    return this.resolveType(type).version;
  }

  resolveDefinitionNode(definition: WorkflowDefinition, nodeId: string): Node {
    const node = definition.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      throw new NodeNotFoundException(
        `Node "${nodeId}" not found in Workflow Definition "${definition.id}"`,
      );
    }
    return node;
  }
}
