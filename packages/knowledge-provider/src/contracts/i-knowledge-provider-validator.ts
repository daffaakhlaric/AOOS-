import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";
import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";

export interface KnowledgeProviderValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgeProviderValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeProviderValidationIssue[];
}

export interface KnowledgeProviderValidationInput {
  readonly metadata: ProviderMetadataRecord;
  readonly context: KnowledgeProviderContext;
}

/** A caller-supplied extra validation stage `KnowledgeProviderValidator` runs alongside its own 8 built-in stages. */
export interface IKnowledgeProviderValidator {
  readonly name: string;
  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult;
}
