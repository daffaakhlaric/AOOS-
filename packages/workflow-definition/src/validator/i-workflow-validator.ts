import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/** One stage of the Workflow Validation pipeline (Structural/Transition/Duplicate/Cycle/Variable/Expression/Version/Permission). */
export interface IWorkflowValidator {
  readonly name: string;
  validate(workflow: WorkflowDefinition): ValidationResult;
}
