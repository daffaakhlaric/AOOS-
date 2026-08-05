import { ConsistencyValidator } from "./consistency-validator.js";
import { DuplicateValidator } from "./duplicate-validator.js";
import { EmbeddingReferenceValidator } from "./embedding-reference-validator.js";
import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { NamespaceValidator } from "./namespace-validator.js";
import { PermissionValidator } from "./permission-validator.js";
import { PolicyValidator } from "./policy-validator.js";
import { RelationshipValidator } from "./relationship-validator.js";

/**
 * "VALIDATOR: Namespace, Metadata, Relationships, Policy, Permission, Embedding
 * Reference, Duplicate, Consistency." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — runs
 * all 8 stages in fixed order, aggregating every issue without short-circuiting.
 */
export class KnowledgeIndexValidator {
  private readonly stages: readonly IKnowledgeIndexValidatorStage[];

  constructor(extraStages: readonly IKnowledgeIndexValidatorStage[] = []) {
    this.stages = [
      new NamespaceValidator(),
      new MetadataValidator(),
      new RelationshipValidator(),
      new PolicyValidator(),
      new PermissionValidator(),
      new EmbeddingReferenceValidator(),
      new DuplicateValidator(),
      new ConsistencyValidator(),
      ...extraStages,
    ];
  }

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
