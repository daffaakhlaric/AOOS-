import { NodeType } from "../contracts/node-type.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type {
  IWorkflowValidator,
  ValidationIssue,
  ValidationResult,
} from "./i-workflow-validator.js";

/**
 * Workflow Validation + Node Validation (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md
 * — "VALIDATION"): exactly one `Start` node, at least one `End` node, and every node-id
 * reference a Node/Parallel/Merge/Loop/Compensation field points at resolves to a real
 * node in the same Workflow.
 */
export class StructuralValidator implements IWorkflowValidator {
  readonly name = "structural";

  validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];
    const nodeIds = new Set(workflow.nodes.map((node) => node.id));

    const startNodes = workflow.nodes.filter((node) => node.type === NodeType.START);
    if (startNodes.length !== 1) {
      issues.push({
        path: "nodes",
        message: `Workflow must have exactly one Start node, found ${startNodes.length}`,
      });
    }

    const endNodes = workflow.nodes.filter((node) => node.type === NodeType.END);
    if (endNodes.length === 0) {
      issues.push({ path: "nodes", message: "Workflow must have at least one End node" });
    }

    for (const node of workflow.nodes) {
      const path = `nodes.${node.id}`;
      if (node.type === NodeType.PARALLEL) {
        for (const branchId of node.branchNodeIds) {
          if (!nodeIds.has(branchId)) {
            issues.push({
              path: `${path}.branchNodeIds`,
              message: `Unknown node id "${branchId}"`,
            });
          }
        }
      }
      if (node.type === NodeType.MERGE) {
        for (const joinId of node.joinNodeIds) {
          if (!nodeIds.has(joinId)) {
            issues.push({ path: `${path}.joinNodeIds`, message: `Unknown node id "${joinId}"` });
          }
        }
      }
      if (node.type === NodeType.LOOP && !nodeIds.has(node.bodyNodeId)) {
        issues.push({
          path: `${path}.bodyNodeId`,
          message: `Unknown node id "${node.bodyNodeId}"`,
        });
      }
      if (node.compensation && !nodeIds.has(node.compensation.compensationNodeId)) {
        issues.push({
          path: `${path}.compensation.compensationNodeId`,
          message: `Unknown node id "${node.compensation.compensationNodeId}"`,
        });
      }
    }

    if (workflow.compensation && !nodeIds.has(workflow.compensation.compensationNodeId)) {
      issues.push({
        path: "compensation.compensationNodeId",
        message: `Unknown node id "${workflow.compensation.compensationNodeId}"`,
      });
    }

    return { valid: issues.length === 0, issues };
  }
}
