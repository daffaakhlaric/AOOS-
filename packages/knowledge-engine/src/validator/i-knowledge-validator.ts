import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import type { KnowledgeCollection } from "../domain/knowledge-collection.js";
import type { KnowledgePermission } from "../domain/knowledge-permission.js";
import type { KnowledgePolicy } from "../domain/knowledge-policy.js";
import type { KnowledgeRelationship } from "../domain/knowledge-relationship.js";
import type { KnowledgeSchema } from "../domain/knowledge-schema.js";
import type { KnowledgeTemplate } from "../domain/knowledge-template.js";
import type { KnowledgeRepository } from "../repository/knowledge-repository.js";

export interface KnowledgeValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface KnowledgeValidationResult {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeValidationIssue[];
}

export interface KnowledgeValidationInput {
  readonly asset?: KnowledgeAsset;
  readonly schema?: KnowledgeSchema;
  readonly relationship?: KnowledgeRelationship;
  readonly repository?: KnowledgeRepository;
  readonly collection?: KnowledgeCollection;
  readonly template?: KnowledgeTemplate;
  readonly policy?: KnowledgePolicy;
  readonly permission?: KnowledgePermission;
  readonly allowedLanguages?: readonly string[];
  readonly allowedTenantIds?: readonly string[];
  readonly allowedWorkspaceIds?: readonly string[];
}

/** One stage of `KnowledgeValidator` (Schema/Metadata/Version/Relationship/Namespace/Policy/Permission/Classification/Language/Ownership/Tenant/Workspace/Collection/Template — docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "VALIDATION"). */
export interface IKnowledgeValidatorStage {
  readonly name: string;
  validate(input: KnowledgeValidationInput): KnowledgeValidationResult;
}
