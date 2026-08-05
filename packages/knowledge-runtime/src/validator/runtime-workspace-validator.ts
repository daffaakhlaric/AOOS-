import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags a Context `workspaceId` not present in a configured allow-list (no-op when unconfigured or unset). */
export class RuntimeWorkspaceValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "workspace";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const { allowedWorkspaceIds, execution } = input;
    const workspaceId = execution.context.workspaceId;
    if (
      allowedWorkspaceIds &&
      workspaceId !== undefined &&
      !allowedWorkspaceIds.includes(workspaceId)
    ) {
      return {
        valid: false,
        issues: [
          {
            path: "context.workspaceId",
            message: `Workspace "${workspaceId}" is not in the allowed Workspace list`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
