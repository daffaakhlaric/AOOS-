import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";

import { AssignmentValidator } from "./assignment-validator.js";
import { ConditionsValidator } from "./conditions-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import { IdentityValidator } from "./identity-validator.js";
import { IntegrityValidator } from "./integrity-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { PolicyTypeValidator } from "./policy-type-validator.js";
import { RulesValidator } from "./rules-validator.js";
import { ScopeValidator } from "./scope-validator.js";

export interface KnowledgePolicyValidatorOptions {
  readonly extraStages?: readonly IKnowledgePolicyValidator[];
}

/**
 * "VALIDATOR: Implement EXACTLY 10 stages. 1. Identity 2. Metadata 3. Scope
 * 4. Rules 5. Conditions 6. Assignment 7. Policy Type 8. Configuration
 * 9. Dependency 10. Integrity" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — runs all
 * 10 stages in this fixed order, aggregating every issue without short-circuiting.
 */
export class KnowledgePolicyValidator {
  private readonly stages: readonly IKnowledgePolicyValidator[];

  constructor(options: KnowledgePolicyValidatorOptions = {}) {
    this.stages = [
      new IdentityValidator(),
      new MetadataValidator(),
      new ScopeValidator(),
      new RulesValidator(),
      new ConditionsValidator(),
      new AssignmentValidator(),
      new PolicyTypeValidator(),
      new ConfigurationValidator(),
      new DependencyValidator(),
      new IntegrityValidator(),
      ...(options.extraStages ?? []),
    ];
  }

  get stageNames(): readonly string[] {
    return this.stages.map((stage) => stage.name);
  }

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
