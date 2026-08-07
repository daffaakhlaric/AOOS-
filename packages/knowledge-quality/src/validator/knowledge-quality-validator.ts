import type {
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";

import { AssessmentValidator } from "./assessment-validator.js";
import { AuditValidator } from "./audit-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import { IdentityValidator } from "./identity-validator.js";
import { IntegrityValidator } from "./integrity-validator.js";
import { LifecycleValidator } from "./lifecycle-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { PolicyValidator } from "./policy-validator.js";
import { ProfileValidator } from "./profile-validator.js";
import { RuleValidator } from "./rule-validator.js";
import { StatisticsValidator } from "./statistics-validator.js";

export interface KnowledgeQualityValidatorOptions {
  readonly extraStages?: readonly IKnowledgeQualityValidator[];
}

/**
 * "VALIDATOR: Implement EXACTLY 12 stages. 1 Identity 2 Metadata 3 Assessment 4 Rule
 * 5 Profile 6 Policy 7 Configuration 8 Lifecycle 9 Dependency 10 Statistics
 * 11 Integrity 12 Audit" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — runs all 12
 * stages in this fixed order, aggregating every issue without short-circuiting.
 */
export class KnowledgeQualityValidator {
  private readonly stages: readonly IKnowledgeQualityValidator[];

  constructor(options: KnowledgeQualityValidatorOptions = {}) {
    this.stages = [
      new IdentityValidator(),
      new MetadataValidator(),
      new AssessmentValidator(),
      new RuleValidator(),
      new ProfileValidator(),
      new PolicyValidator(),
      new ConfigurationValidator(),
      new LifecycleValidator(),
      new DependencyValidator(),
      new StatisticsValidator(),
      new IntegrityValidator(),
      new AuditValidator(),
      ...(options.extraStages ?? []),
    ];
  }

  get stageNames(): readonly string[] {
    return this.stages.map((stage) => stage.name);
  }

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
