import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../contracts/i-knowledge-source-validator.js";

import { CategoryValidator } from "./category-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { ExecutionTokenValidator } from "./execution-token-validator.js";
import { ProviderReferenceValidator } from "./provider-reference-validator.js";
import { SourceIdValidator } from "./source-id-validator.js";
import { SourceNameValidator } from "./source-name-validator.js";
import { TenantValidator } from "./tenant-validator.js";

/**
 * "KnowledgeSourceValidator" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC
 * API") — runs 7 stages in fixed order, aggregating every issue without
 * short-circuiting: Source Id, Source Name, Provider Reference, Category, Configuration,
 * Tenant, Execution Token.
 */
export class KnowledgeSourceValidator {
  private readonly stages: readonly IKnowledgeSourceValidator[];

  constructor(extraStages: readonly IKnowledgeSourceValidator[] = []) {
    this.stages = [
      new SourceIdValidator(),
      new SourceNameValidator(),
      new ProviderReferenceValidator(),
      new CategoryValidator(),
      new ConfigurationValidator(),
      new TenantValidator(),
      new ExecutionTokenValidator(),
      ...extraStages,
    ];
  }

  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
