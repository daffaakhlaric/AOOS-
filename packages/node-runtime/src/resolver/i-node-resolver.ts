import type { Node, WorkflowDefinition } from "@aos/workflow-definition";

import type { NodeManifest } from "../contracts/node-manifest.js";
import type { NodeType } from "../contracts/node-type.js";

/** Resolves Node Type / Node Version / Node Definition / Registry lookups (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "NODE RESOLVER"). */
export interface INodeResolver {
  resolveType(type: NodeType): NodeManifest;
  resolveVersion(type: NodeType): string;
  resolveDefinitionNode(definition: WorkflowDefinition, nodeId: string): Node;
}
