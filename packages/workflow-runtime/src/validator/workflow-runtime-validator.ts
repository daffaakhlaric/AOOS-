import { TenantScope, ValidationPipeline, type WorkflowDefinition } from "@aos/workflow-definition";

import type { WorkflowContext } from "../context/workflow-context.js";

import type {
  IWorkflowRuntimeValidator,
  RuntimeValidationIssue,
  RuntimeValidationResult,
} from "./i-workflow-runtime-validator.js";

/**
 * "Validate before execution. Reuse 005.6A validators whenever possible."
 * (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md — "WORKFLOW VALIDATOR"). Runs
 * `@aos/workflow-definition`'s full `ValidationPipeline` (Structural/Transition/
 * Duplicate/Cycle/Variable/Expression/Version/Permission) and adds one runtime-only
 * check: Tenant Isolation.
 */
export class WorkflowRuntimeValidator implements IWorkflowRuntimeValidator {
  private readonly definitionValidationPipeline = new ValidationPipeline();

  validate(definition: WorkflowDefinition, context: WorkflowContext): RuntimeValidationResult {
    const issues: RuntimeValidationIssue[] = [];

    const definitionResult = this.definitionValidationPipeline.run(definition);
    for (const issue of definitionResult.issues) {
      issues.push({ path: issue.path, message: issue.message });
    }

    if (
      definition.tenantScope === TenantScope.TENANT &&
      definition.tenantId !== undefined &&
      context.tenantId !== definition.tenantId
    ) {
      issues.push({
        path: "tenantId",
        message: `Execution Context tenantId "${String(context.tenantId)}" does not match Workflow Definition "${definition.id}"'s Tenant Isolation scope "${definition.tenantId}"`,
      });
    }

    return { valid: issues.length === 0, issues };
  }
}
