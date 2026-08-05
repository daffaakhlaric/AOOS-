import type { KnowledgeAsset } from "@aos/knowledge-engine";

import type { KnowledgeIndexContext } from "../context/knowledge-index-context.js";
import type { KnowledgeIndexType } from "../domain/knowledge-index-type.js";
import type { KnowledgeIndexRegistry } from "../registry/knowledge-index-registry.js";

export interface KnowledgeIndexValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgeIndexValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeIndexValidationIssue[];
}

export interface KnowledgeIndexValidationInput {
  readonly asset: KnowledgeAsset;
  readonly context: KnowledgeIndexContext;
  readonly registry: KnowledgeIndexRegistry;
  readonly indexTypes: readonly KnowledgeIndexType[];
}

/** One stage of `KnowledgeIndexValidator` (Namespace/Metadata/Relationships/Policy/Permission/Embedding Reference/Duplicate/Consistency — docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "VALIDATOR"). */
export interface IKnowledgeIndexValidatorStage {
  readonly name: string;
  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult;
}
