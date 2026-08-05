import type { WorkflowDefinition } from "@aos/workflow-definition";

import type { NodeType } from "../contracts/node-type.js";
import type { NodeInstance } from "../instance/node-instance.js";
import type { NodeMetadata } from "../instance/node-metadata.js";

export interface CreateFromDefinitionInput {
  readonly workflowInstanceId: string;
  readonly definition: WorkflowDefinition;
  readonly nodeId: string;
}

export interface CreateFromRegistryInput {
  readonly workflowInstanceId: string;
  readonly nodeId: string;
  readonly type: NodeType;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly metadata?: NodeMetadata;
}

/** A minimal, storage-agnostic Node description — the shape a Solution Pack or a hand-authored fixture supplies when there is no full `WorkflowDefinition` to resolve against. */
export interface NodeBlueprint {
  readonly nodeId: string;
  readonly type: NodeType;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly dependsOn?: readonly string[];
  readonly metadata?: NodeMetadata;
}

export interface CreateFromBlueprintInput {
  readonly workflowInstanceId: string;
  readonly blueprint: NodeBlueprint;
}

/** "NODE FACTORY: Create Node from: Workflow Definition, Registry, Blueprint." (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md). */
export interface INodeFactory {
  createFromDefinition(input: CreateFromDefinitionInput): NodeInstance;
  createFromRegistry(input: CreateFromRegistryInput): NodeInstance;
  createFromBlueprint(input: CreateFromBlueprintInput): NodeInstance;
}
