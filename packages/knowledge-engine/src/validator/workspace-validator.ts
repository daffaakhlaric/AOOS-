import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Workspace" — when `allowedWorkspaceIds` is configured, the Asset's `scope.workspaceId` (if set) must be one of them. */
export class WorkspaceValidator implements IKnowledgeValidatorStage {
  readonly name = "workspace";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const workspaceId = input.asset?.scope.workspaceId;
    if (
      input.allowedWorkspaceIds &&
      workspaceId &&
      !input.allowedWorkspaceIds.includes(workspaceId)
    ) {
      issues.push({
        path: "scope.workspaceId",
        message: `Workspace "${workspaceId}" is not in the allowed Workspace list`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
