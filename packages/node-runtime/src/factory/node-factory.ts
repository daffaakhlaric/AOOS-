import { NodeFactoryException } from "../errors/node-factory-exception.js";
import { createNodeInstance } from "../instance/create-node-instance.js";
import type { NodeInstance } from "../instance/node-instance.js";
import type { INodeRegistry } from "../registry/i-node-registry.js";
import type { INodeResolver } from "../resolver/i-node-resolver.js";

import { deriveConfigFromDefinitionNode } from "./derive-config-from-definition-node.js";
import type {
  CreateFromBlueprintInput,
  CreateFromDefinitionInput,
  CreateFromRegistryInput,
  INodeFactory,
} from "./i-node-factory.js";
import { mapDefinitionNodeType } from "./node-type-mapper.js";

export class NodeFactory implements INodeFactory {
  constructor(
    private readonly registry: INodeRegistry,
    private readonly resolver: INodeResolver,
  ) {}

  createFromDefinition(input: CreateFromDefinitionInput): NodeInstance {
    const definitionNode = this.resolver.resolveDefinitionNode(input.definition, input.nodeId);
    const type = mapDefinitionNodeType(definitionNode.type);
    if (!this.registry.has(type)) {
      throw new NodeFactoryException(
        `Cannot create Node "${input.nodeId}": mapped Node Type "${type}" is not registered`,
      );
    }
    const dependsOn = (input.definition.transitions ?? [])
      .filter((transition) => transition.toNodeId === definitionNode.id)
      .map((transition) => transition.fromNodeId);

    return createNodeInstance({
      workflowInstanceId: input.workflowInstanceId,
      nodeId: definitionNode.id,
      type,
      config: deriveConfigFromDefinitionNode(definitionNode),
      dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
      metadata: { source: "workflow-definition", name: definitionNode.name },
    });
  }

  createFromRegistry(input: CreateFromRegistryInput): NodeInstance {
    if (!this.registry.has(input.type)) {
      throw new NodeFactoryException(
        `Cannot create Node "${input.nodeId}": Node Type "${input.type}" is not registered`,
      );
    }
    return createNodeInstance({
      workflowInstanceId: input.workflowInstanceId,
      nodeId: input.nodeId,
      type: input.type,
      config: input.config,
      metadata: input.metadata,
    });
  }

  createFromBlueprint(input: CreateFromBlueprintInput): NodeInstance {
    if (!this.registry.has(input.blueprint.type)) {
      throw new NodeFactoryException(
        `Cannot create Node "${input.blueprint.nodeId}" from Blueprint: Node Type "${input.blueprint.type}" is not registered`,
      );
    }
    return createNodeInstance({
      workflowInstanceId: input.workflowInstanceId,
      nodeId: input.blueprint.nodeId,
      type: input.blueprint.type,
      config: input.blueprint.config,
      dependsOn: input.blueprint.dependsOn,
      metadata: input.blueprint.metadata,
    });
  }
}
