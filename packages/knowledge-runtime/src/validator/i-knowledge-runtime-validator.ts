import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";

export interface KnowledgeRuntimeValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgeRuntimeValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeRuntimeValidationIssue[];
}

export interface KnowledgeRuntimeValidationInput {
  readonly execution: KnowledgeRuntimeExecution;
  readonly allowedTenantIds?: readonly string[];
  readonly allowedWorkspaceIds?: readonly string[];
}

/** One stage of `KnowledgeRuntimeValidator` (Runtime State/Context/Permission/Policy/Lifecycle/Relationships/Namespace/Metadata/Tenant/Workspace/Execution Token — docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md — "RUNTIME VALIDATOR"). */
export interface IKnowledgeRuntimeValidatorStage {
  readonly name: string;
  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult;
}
