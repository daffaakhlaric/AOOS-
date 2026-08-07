import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

import { CategoryValidator } from "./category-validator.js";
import { CertificationValidator } from "./certification-validator.js";
import { CompatibilityValidator } from "./compatibility-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import { IdentityValidator } from "./identity-validator.js";
import { IntegrityValidator } from "./integrity-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { PublisherValidator } from "./publisher-validator.js";
import { VersionValidator } from "./version-validator.js";

export interface KnowledgeMarketplaceValidatorOptions {
  readonly extraStages?: readonly IKnowledgeMarketplaceValidator[];
}

/**
 * "VALIDATOR: Implement EXACTLY 10 stages. 1. Identity 2. Metadata 3. Category
 * 4. Publisher 5. Dependency 6. Compatibility 7. Version 8. Certification
 * 9. Configuration 10. Integrity" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — runs
 * all 10 stages in this fixed order, aggregating every issue without short-circuiting.
 */
export class KnowledgeMarketplaceValidator {
  private readonly stages: readonly IKnowledgeMarketplaceValidator[];

  constructor(options: KnowledgeMarketplaceValidatorOptions = {}) {
    this.stages = [
      new IdentityValidator(),
      new MetadataValidator(),
      new CategoryValidator(),
      new PublisherValidator(),
      new DependencyValidator(),
      new CompatibilityValidator(),
      new VersionValidator(),
      new CertificationValidator(),
      new ConfigurationValidator(),
      new IntegrityValidator(),
      ...(options.extraStages ?? []),
    ];
  }

  get stageNames(): readonly string[] {
    return this.stages.map((stage) => stage.name);
  }

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
