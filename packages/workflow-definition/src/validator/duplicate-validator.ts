import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type {
  IWorkflowValidator,
  ValidationIssue,
  ValidationResult,
} from "./i-workflow-validator.js";

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Array.from(duplicates);
}

/** Duplicate Detection (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "VALIDATION"): Node ids, Transition ids, and Variable names (within the same scope) must be unique. */
export class DuplicateValidator implements IWorkflowValidator {
  readonly name = "duplicate";

  validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];

    for (const nodeId of findDuplicates(workflow.nodes.map((node) => node.id))) {
      issues.push({ path: "nodes", message: `Duplicate node id "${nodeId}"` });
    }

    for (const transitionId of findDuplicates((workflow.transitions ?? []).map((t) => t.id))) {
      issues.push({ path: "transitions", message: `Duplicate transition id "${transitionId}"` });
    }

    const workflowVariableNames = (workflow.variables ?? []).map((v) => `${v.scope}:${v.name}`);
    for (const key of findDuplicates(workflowVariableNames)) {
      const [, name] = key.split(":");
      issues.push({
        path: "variables",
        message: `Duplicate variable name "${name}" in this scope`,
      });
    }

    for (const node of workflow.nodes) {
      const nodeVariableNames = (node.variables ?? []).map((v) => `${v.scope}:${v.name}`);
      for (const key of findDuplicates(nodeVariableNames)) {
        const [, name] = key.split(":");
        issues.push({
          path: `nodes.${node.id}.variables`,
          message: `Duplicate variable name "${name}" in this scope`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
