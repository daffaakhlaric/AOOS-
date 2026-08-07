import type {
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";

import { AuditValidator } from "./audit-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { DecisionValidator } from "./decision-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import { IdentityValidator } from "./identity-validator.js";
import { IntegrityValidator } from "./integrity-validator.js";
import { LifecycleValidator } from "./lifecycle-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { PolicyValidator } from "./policy-validator.js";
import { RuleValidator } from "./rule-validator.js";
import { StatisticsValidator } from "./statistics-validator.js";
import { ValidationValidator } from "./validation-validator.js";

export interface KnowledgeValidatorValidatorOptions {
  readonly extraStages?: readonly IKnowledgeValidatorStage[];
}

/**
 * "VALIDATOR: Implement EXACTLY 12 stages. 1 Identity 2 Metadata 3 Validation 4 Rule
 * 5 Policy 6 Decision 7 Configuration 8 Lifecycle 9 Dependency 10 Statistics
 * 11 Integrity 12 Audit" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — runs all 12
 * stages in this fixed order, aggregating every issue without short-circuiting.
 *
 * Named `KnowledgeValidatorValidator` per the spec's literal "Public API" list — the
 * package's façade is `KnowledgeValidator` (`validation/knowledge-validator.ts`); this
 * class is the distinct 12-stage aggregator it drives via the Pipeline's own Stage 1
 * (also named "Validation"). See docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md —
 * "Pipeline" for the full triple "Validation" naming distinction.
 */
export class KnowledgeValidatorValidator {
  private readonly stages: readonly IKnowledgeValidatorStage[];

  constructor(options: KnowledgeValidatorValidatorOptions = {}) {
    this.stages = [
      new IdentityValidator(),
      new MetadataValidator(),
      new ValidationValidator(),
      new RuleValidator(),
      new PolicyValidator(),
      new DecisionValidator(),
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

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
