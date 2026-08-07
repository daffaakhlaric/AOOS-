import type {
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";

import { AuditValidator } from "./audit-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { ContextValidator } from "./context-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import { IdentityValidator } from "./identity-validator.js";
import { IntegrityValidator } from "./integrity-validator.js";
import { LifecycleValidator } from "./lifecycle-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { PolicyValidator } from "./policy-validator.js";
import { PromptValidator } from "./prompt-validator.js";
import { ProviderValidator } from "./provider-validator.js";
import { RequestValidator } from "./request-validator.js";

export interface KnowledgeGeneratorValidatorOptions {
  readonly extraStages?: readonly IKnowledgeGeneratorValidator[];
}

/**
 * "VALIDATOR: Implement EXACTLY 12 stages. 1 Identity 2 Metadata 3 Request 4 Context
 * 5 Prompt 6 Policy 7 Provider 8 Configuration 9 Lifecycle 10 Dependency 11 Integrity
 * 12 Audit" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — runs all 12 stages in this
 * fixed order, aggregating every issue without short-circuiting.
 */
export class KnowledgeGeneratorValidator {
  private readonly stages: readonly IKnowledgeGeneratorValidator[];

  constructor(options: KnowledgeGeneratorValidatorOptions = {}) {
    this.stages = [
      new IdentityValidator(),
      new MetadataValidator(),
      new RequestValidator(),
      new ContextValidator(),
      new PromptValidator(),
      new PolicyValidator(),
      new ProviderValidator(),
      new ConfigurationValidator(),
      new LifecycleValidator(),
      new DependencyValidator(),
      new IntegrityValidator(),
      new AuditValidator(),
      ...(options.extraStages ?? []),
    ];
  }

  get stageNames(): readonly string[] {
    return this.stages.map((stage) => stage.name);
  }

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
