import type { WorkflowDefinition } from "@aos/workflow-definition";

import type { WorkflowContext } from "../context/workflow-context.js";

export interface RuntimeValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface RuntimeValidationResult {
  readonly valid: boolean;
  readonly issues: readonly RuntimeValidationIssue[];
}

/** Validates a Workflow Definition + its Execution Context are safe to execute — reuses `@aos/workflow-definition`'s `ValidationPipeline` and adds runtime-only checks (Tenant Isolation). */
export interface IWorkflowRuntimeValidator {
  validate(definition: WorkflowDefinition, context: WorkflowContext): RuntimeValidationResult;
}
