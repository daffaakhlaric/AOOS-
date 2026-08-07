import type { KnowledgePolicyContext } from "../context/knowledge-policy-context.js";
import type { KnowledgePolicyConfigurationRecord } from "../domain/knowledge-policy-configuration-record.js";
import type { KnowledgePolicyMetadata } from "../domain/knowledge-policy-metadata.js";
import type { KnowledgePolicyState } from "../domain/knowledge-policy-state.js";

export interface KnowledgePolicyValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgePolicyValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgePolicyValidationIssue[];
}

/**
 * The unit every Validator stage reads. `currentState`/`targetState` feed the Lifecycle
 * stage — all optional so the Validator can also run standalone on a bare
 * metadata/context/configuration triple.
 */
export interface KnowledgePolicyValidationInput {
  readonly metadata: KnowledgePolicyMetadata;
  readonly context: KnowledgePolicyContext;
  readonly configuration: KnowledgePolicyConfigurationRecord;
  readonly currentState?: KnowledgePolicyState;
  readonly targetState?: KnowledgePolicyState;
  readonly ruleCount?: number;
  readonly assignmentCount?: number;
  readonly knownPolicyIds?: readonly string[];
}

/** A caller-supplied extra validation stage `KnowledgePolicyValidator` runs alongside its own 10 built-in stages. */
export interface IKnowledgePolicyValidator {
  readonly name: string;
  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult;
}
