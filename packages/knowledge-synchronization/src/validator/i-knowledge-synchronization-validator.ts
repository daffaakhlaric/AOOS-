import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";

export interface KnowledgeSynchronizationValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgeSynchronizationValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeSynchronizationValidationIssue[];
}

export interface KnowledgeSynchronizationValidationInput {
  readonly job: KnowledgeSynchronizationJob;
  readonly context: KnowledgeSynchronizationContext;
}

/** One stage of `KnowledgeSynchronizationValidator` (Provider/Source/Namespace/Policy/Permission/Schedule/Metadata/Relationship/Version/Tenant/Workspace/Execution Token — docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md — "VALIDATOR"). */
export interface IKnowledgeSynchronizationValidatorStage {
  readonly name: string;
  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult;
}
