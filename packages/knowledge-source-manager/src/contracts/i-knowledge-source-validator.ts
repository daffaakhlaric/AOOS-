import type { KnowledgeSourceConfigurationRecord } from "../configuration/knowledge-source-configuration-record.js";
import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

export interface KnowledgeSourceValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgeSourceValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeSourceValidationIssue[];
}

export interface KnowledgeSourceValidationInput {
  readonly metadata: KnowledgeSourceMetadataRecord;
  readonly context: KnowledgeSourceContext;
  readonly configuration: KnowledgeSourceConfigurationRecord;
}

/** A caller-supplied extra validation stage `KnowledgeSourceValidator` runs alongside its own built-in stages. */
export interface IKnowledgeSourceValidator {
  readonly name: string;
  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult;
}
