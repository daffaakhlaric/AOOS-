import type { KnowledgeVersionConfigurationRecord } from "../configuration/knowledge-version-configuration-record.js";
import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";
import type { KnowledgeBranch } from "../domain/knowledge-branch.js";
import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";
import type { KnowledgeVersionState } from "../domain/knowledge-version-state.js";

export interface KnowledgeVersionValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgeVersionValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeVersionValidationIssue[];
}

/**
 * The unit every Validator stage reads. `currentState`/`targetState` feed the Lifecycle
 * stage, `branch` feeds the Branch stage (the resolved `KnowledgeBranch` when
 * `metadata.branchId` is set), and `knownVersionIds` feeds the Dependency stage — all
 * optional so the Validator can also run standalone on a bare
 * metadata/context/configuration triple.
 */
export interface KnowledgeVersionValidationInput {
  readonly metadata: KnowledgeVersionMetadata;
  readonly context: KnowledgeVersionContext;
  readonly configuration: KnowledgeVersionConfigurationRecord;
  readonly currentState?: KnowledgeVersionState;
  readonly targetState?: KnowledgeVersionState;
  readonly branch?: KnowledgeBranch;
  readonly knownVersionIds?: readonly string[];
}

/** A caller-supplied extra validation stage `KnowledgeVersionValidator` runs alongside its own 10 built-in stages. */
export interface IKnowledgeVersionValidator {
  readonly name: string;
  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult;
}
