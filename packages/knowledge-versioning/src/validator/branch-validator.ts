import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationIssue,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";
import { knowledgeBranchSchema } from "../domain/knowledge-branch.js";

/**
 * Stage 5 — Branch: when `metadata.branchId` is set, the resolved `KnowledgeBranch`
 * must be supplied, match the declared id, belong to the same Asset, and satisfy the
 * branch schema (which pins `branchType` to the 7 `KnowledgeBranchType` values).
 */
export class BranchValidator implements IKnowledgeVersionValidator {
  readonly name = "branch";

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    if (input.metadata.branchId === undefined) {
      return { valid: true, issues: [] };
    }
    const issues: KnowledgeVersionValidationIssue[] = [];
    if (!input.branch) {
      issues.push({
        path: "metadata.branchId",
        message: `Version declares Branch "${input.metadata.branchId}" but no such Branch is registered`,
      });
      return { valid: false, issues };
    }
    if (input.branch.id !== input.metadata.branchId) {
      issues.push({
        path: "branch.id",
        message: "Resolved Branch id must match metadata branchId",
      });
    }
    if (input.branch.assetId !== input.metadata.assetId) {
      issues.push({
        path: "branch.assetId",
        message: "Resolved Branch must belong to the same Asset as the Version",
      });
    }
    if (!knowledgeBranchSchema.safeParse(input.branch).success) {
      issues.push({
        path: "branch",
        message: "Resolved Branch failed KnowledgeBranch schema validation",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
