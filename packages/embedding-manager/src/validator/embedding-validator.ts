import type {
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

import { AuditValidator } from "./audit-validator.js";
import { ConfigurationValidator } from "./configuration-validator.js";
import { DependencyValidator } from "./dependency-validator.js";
import { IdentityValidator } from "./identity-validator.js";
import { IntegrityValidator } from "./integrity-validator.js";
import { LifecycleValidator } from "./lifecycle-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { ModelValidator } from "./model-validator.js";
import { NamespaceValidator } from "./namespace-validator.js";
import { ProviderValidator } from "./provider-validator.js";
import { StatisticsValidator } from "./statistics-validator.js";
import { VersionValidator } from "./version-validator.js";

export interface EmbeddingValidatorOptions {
  readonly extraStages?: readonly IEmbeddingValidatorStage[];
}

/**
 * "VALIDATOR: Implement EXACTLY 12 stages. 1 Identity 2 Metadata 3 Provider 4 Model
 * 5 Namespace 6 Configuration 7 Version 8 Lifecycle 9 Dependency 10 Statistics
 * 11 Integrity 12 Audit" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — runs all 12
 * stages in this fixed order, aggregating every issue without short-circuiting.
 *
 * `EmbeddingValidator` is both the class name AND a top-level Public API export — unlike
 * `@aos/knowledge-validator` (005.7M), this package's spec has no separate "facade"
 * literally named "...Validator", so there is no same-name collision to resolve here.
 * The package's façade is `EmbeddingManager` (`embedding/embedding-manager.ts`), which
 * drives this class via the Pipeline's own Stage 1 (also named "Validation" — see
 * docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Validation" for the Validator-stage vs
 * Pipeline-stage naming distinction).
 */
export class EmbeddingValidator {
  private readonly stages: readonly IEmbeddingValidatorStage[];

  constructor(options: EmbeddingValidatorOptions = {}) {
    this.stages = [
      new IdentityValidator(),
      new MetadataValidator(),
      new ProviderValidator(),
      new ModelValidator(),
      new NamespaceValidator(),
      new ConfigurationValidator(),
      new VersionValidator(),
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

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
