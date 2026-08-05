import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a mismatch between `job.workspaceId` and `context.workspaceId` when both are set. */
export class WorkspaceValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "workspace";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const { workspaceId: jobWorkspaceId } = input.job;
    const { workspaceId: contextWorkspaceId } = input.context;
    if (
      jobWorkspaceId !== undefined &&
      contextWorkspaceId !== undefined &&
      jobWorkspaceId !== contextWorkspaceId
    ) {
      return {
        valid: false,
        issues: [
          {
            path: "job.workspaceId",
            message: "Job workspaceId must match Context workspaceId when both are set",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
