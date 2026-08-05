import { ExecutionTokenValidator } from "./execution-token-validator.js";
import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";
import { MetadataValidator } from "./metadata-validator.js";
import { NamespaceValidator } from "./namespace-validator.js";
import { PermissionValidator } from "./permission-validator.js";
import { PolicyValidator } from "./policy-validator.js";
import { ProviderValidator } from "./provider-validator.js";
import { RelationshipValidator } from "./relationship-validator.js";
import { ScheduleValidator } from "./schedule-validator.js";
import { SourceValidator } from "./source-validator.js";
import { TenantValidator } from "./tenant-validator.js";
import { VersionValidator } from "./version-validator.js";
import { WorkspaceValidator } from "./workspace-validator.js";

/**
 * "VALIDATOR: Validate Provider, Source, Namespace, Policy, Permission, Schedule,
 * Metadata, Relationship, Version, Tenant, Workspace, Execution Token."
 * (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — runs 12 stages in fixed order,
 * aggregating every issue without short-circuiting.
 */
export class KnowledgeSynchronizationValidator {
  private readonly stages: readonly IKnowledgeSynchronizationValidatorStage[];

  constructor(extraStages: readonly IKnowledgeSynchronizationValidatorStage[] = []) {
    this.stages = [
      new ProviderValidator(),
      new SourceValidator(),
      new NamespaceValidator(),
      new PolicyValidator(),
      new PermissionValidator(),
      new ScheduleValidator(),
      new MetadataValidator(),
      new RelationshipValidator(),
      new VersionValidator(),
      new TenantValidator(),
      new WorkspaceValidator(),
      new ExecutionTokenValidator(),
      ...extraStages,
    ];
  }

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
