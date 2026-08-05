import type { WorkflowDefinitionStatus } from "../contracts/workflow-definition-status.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

/** The stored envelope wrapping a Workflow Definition with its Registry lifecycle status. */
export interface WorkflowDefinitionEntry {
  readonly workflow: WorkflowDefinition;
  readonly status: WorkflowDefinitionStatus;
  readonly registeredAt: string;
  readonly updatedAt: string;
}
