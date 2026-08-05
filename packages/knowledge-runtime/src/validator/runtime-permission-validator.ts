import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags a `context.permission` reference that is present but blank — actual grant/deny enforcement is `PermissionMiddleware`'s job via `@aos/knowledge-engine`'s `KnowledgePermissionEngine`, never duplicated here. */
export class RuntimePermissionValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "permission";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const { permission } = input.execution.context;
    if (permission !== undefined && permission.trim().length === 0) {
      return {
        valid: false,
        issues: [
          { path: "context.permission", message: "Context permission, if set, must not be blank" },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
