import { ContextValidator } from "./context-validator.js";
import { ExecutionTokenValidator } from "./execution-token-validator.js";
import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";
import { RuntimeLifecycleValidator } from "./runtime-lifecycle-validator.js";
import { RuntimeMetadataValidator } from "./runtime-metadata-validator.js";
import { RuntimeNamespaceValidator } from "./runtime-namespace-validator.js";
import { RuntimePermissionValidator } from "./runtime-permission-validator.js";
import { RuntimePolicyValidator } from "./runtime-policy-validator.js";
import { RuntimeRelationshipValidator } from "./runtime-relationship-validator.js";
import { RuntimeStateValidator } from "./runtime-state-validator.js";
import { RuntimeTenantValidator } from "./runtime-tenant-validator.js";
import { RuntimeWorkspaceValidator } from "./runtime-workspace-validator.js";

/**
 * "RUNTIME VALIDATOR: Runtime State, Context, Permission, Policy, Lifecycle,
 * Relationships, Namespace, Metadata, Tenant, Workspace, Execution Token."
 * (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — runs all 11 stages in fixed order,
 * aggregating every issue without short-circuiting. No duplicated validation logic:
 * enforcement of Permission/Policy grants stays in `@aos/knowledge-engine`'s
 * `KnowledgePermissionEngine`/`KnowledgePolicyEngine`, reached only via
 * `PermissionMiddleware`/`PolicyMiddleware` — these stages only check structural
 * well-formedness.
 */
export class KnowledgeRuntimeValidator {
  private readonly stages: readonly IKnowledgeRuntimeValidatorStage[];

  constructor(extraStages: readonly IKnowledgeRuntimeValidatorStage[] = []) {
    this.stages = [
      new RuntimeStateValidator(),
      new ContextValidator(),
      new RuntimePermissionValidator(),
      new RuntimePolicyValidator(),
      new RuntimeLifecycleValidator(),
      new RuntimeRelationshipValidator(),
      new RuntimeNamespaceValidator(),
      new RuntimeMetadataValidator(),
      new RuntimeTenantValidator(),
      new RuntimeWorkspaceValidator(),
      new ExecutionTokenValidator(),
      ...extraStages,
    ];
  }

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const issues = this.stages.flatMap((stage) => stage.validate(input).issues);
    return { valid: issues.length === 0, issues };
  }
}
