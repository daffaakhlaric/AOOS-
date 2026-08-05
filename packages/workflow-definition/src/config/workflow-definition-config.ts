import type { IWorkflowDefinitionRegistry } from "../registry/i-workflow-definition-registry.js";

export interface WorkflowDefinitionConfig {
  readonly registry?: IWorkflowDefinitionRegistry;
  readonly allowedTenantIds?: readonly string[];
  readonly maxNodes?: number;
  readonly maxTransitions?: number;
}
