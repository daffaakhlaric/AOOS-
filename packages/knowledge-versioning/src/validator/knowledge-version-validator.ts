import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";
import type { KnowledgeVersionPermission } from "../permission/knowledge-version-permission.js";
import type { KnowledgeVersionPolicy } from "../policy/knowledge-version-policy.js";

import { BranchValidator } from "./branch-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import { IdentityValidator } from "./identity-validator.js";
import { IntegrityValidator } from "./integrity-validator.js";
import { LifecycleValidator } from "./lifecycle-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { PermissionValidator } from "./permission-validator.js";
import { PolicyValidator } from "./policy-validator.js";
import { VersionNumberValidator } from "./version-number-validator.js";

export interface KnowledgeVersionValidatorOptions {
  readonly policy?: KnowledgeVersionPolicy;
  readonly permission?: KnowledgeVersionPermission;
  readonly extraStages?: readonly IKnowledgeVersionValidator[];
}

/**
 * "VALIDATOR: Implement a strict 10-stage validator. 1. Identity 2. Metadata 3. Version
 * Number 4. Lifecycle 5. Branch 6. Policy 7. Permission 8. Configuration 9. Dependency
 * 10. Integrity" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — runs all 10 stages in
 * this fixed order, aggregating every issue without short-circuiting, then any
 * caller-supplied `extraStages`.
 */
export class KnowledgeVersionValidator {
  private readonly stages: readonly IKnowledgeVersionValidator[];

  constructor(options: KnowledgeVersionValidatorOptions = {}) {
    this.stages = [
      new IdentityValidator(),
      new MetadataValidator(),
      new VersionNumberValidator(),
      new LifecycleValidator(),
      new BranchValidator(),
      new PolicyValidator(options.policy),
      new PermissionValidator(options.permission),
      new ConfigurationValidator(),
      new DependencyValidator(),
      new IntegrityValidator(),
      ...(options.extraStages ?? []),
    ];
  }

  get stageNames(): readonly string[] {
    return this.stages.map((stage) => stage.name);
  }

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
