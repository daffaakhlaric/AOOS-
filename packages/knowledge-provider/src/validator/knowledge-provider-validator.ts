import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";

import { CapabilitiesValidator } from "./capabilities-validator.js";
import { CategoryValidator } from "./category-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { ExecutionTokenValidator } from "./execution-token-validator.js";
import { ProviderIdValidator } from "./provider-id-validator.js";
import { ProviderNameValidator } from "./provider-name-validator.js";
import { ProviderVersionValidator } from "./provider-version-validator.js";
import { TenantValidator } from "./tenant-validator.js";

/**
 * "KnowledgeProviderValidator" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md — "PUBLIC API")
 * — runs 8 stages in fixed order, aggregating every issue without short-circuiting:
 * Provider Id, Provider Name, Provider Version, Category, Capabilities, Configuration,
 * Tenant, Execution Token.
 */
export class KnowledgeProviderValidator {
  private readonly stages: readonly IKnowledgeProviderValidator[];

  constructor(extraStages: readonly IKnowledgeProviderValidator[] = []) {
    this.stages = [
      new ProviderIdValidator(),
      new ProviderNameValidator(),
      new ProviderVersionValidator(),
      new CategoryValidator(),
      new CapabilitiesValidator(),
      new ConfigurationValidator(),
      new TenantValidator(),
      new ExecutionTokenValidator(),
      ...extraStages,
    ];
  }

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
