import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";
import { KnowledgeVersionPermission } from "../permission/knowledge-version-permission.js";

/**
 * Stage 7 — Permission: runs the real `KnowledgeVersionPermission` grant evaluator
 * ("deny always wins", permissive when unconfigured). A standalone
 * `KnowledgeVersionValidator` constructed without a shared Permission instance evaluates
 * against an empty grant set (allowed) — the Pipeline always passes
 * `KnowledgeVersioning`'s shared instance.
 */
export class PermissionValidator implements IKnowledgeVersionValidator {
  readonly name = "permission";

  constructor(
    private readonly permission: KnowledgeVersionPermission = new KnowledgeVersionPermission(),
  ) {}

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    if (!this.permission.check(input.context, input.metadata)) {
      return {
        valid: false,
        issues: [
          {
            path: "context",
            message: `Permission denied for Version "${input.metadata.versionId}" in Tenant "${input.context.tenantId}"`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
