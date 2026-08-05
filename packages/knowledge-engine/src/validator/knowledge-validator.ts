import { ClassificationValidator } from "./classification-validator.js";
import { CollectionValidator } from "./collection-validator.js";
import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";
import { LanguageValidator } from "./language-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { NamespaceValidator } from "./namespace-validator.js";
import { OwnershipValidator } from "./ownership-validator.js";
import { PermissionValidator } from "./permission-validator.js";
import { PolicyValidator } from "./policy-validator.js";
import { RelationshipValidator } from "./relationship-validator.js";
import { SchemaValidator } from "./schema-validator.js";
import { TemplateValidator } from "./template-validator.js";
import { TenantValidator } from "./tenant-validator.js";
import { VersionValidator } from "./version-validator.js";
import { WorkspaceValidator } from "./workspace-validator.js";

/**
 * "VALIDATION: Validate Schema, Metadata, Version, Relationship, Namespace, Policy,
 * Permission, Classification, Language, Ownership, Tenant, Workspace, Collection,
 * Template. No duplicated validation logic." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md).
 * Runs all 14 stages in order, aggregating every issue — never short-circuits.
 */
export class KnowledgeValidator {
  private readonly stages: readonly IKnowledgeValidatorStage[];

  constructor(extraStages: readonly IKnowledgeValidatorStage[] = []) {
    this.stages = [
      new SchemaValidator(),
      new MetadataValidator(),
      new VersionValidator(),
      new RelationshipValidator(),
      new NamespaceValidator(),
      new PolicyValidator(),
      new PermissionValidator(),
      new ClassificationValidator(),
      new LanguageValidator(),
      new OwnershipValidator(),
      new TenantValidator(),
      new WorkspaceValidator(),
      new CollectionValidator(),
      new TemplateValidator(),
      ...extraStages,
    ];
  }

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    for (const stage of this.stages) {
      issues.push(...stage.validate(input).issues);
    }
    return { valid: issues.length === 0, issues };
  }
}
