import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a blank `namespace` string when supplied, and a mismatch when both Job and Context declare one. */
export class NamespaceValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "namespace";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const issues = [];
    const { namespace: jobNamespace } = input.job;
    const { namespace: contextNamespace } = input.context;
    if (jobNamespace !== undefined && jobNamespace.trim().length === 0) {
      issues.push({ path: "job.namespace", message: "Job namespace must not be blank" });
    }
    if (contextNamespace !== undefined && contextNamespace.trim().length === 0) {
      issues.push({ path: "context.namespace", message: "Context namespace must not be blank" });
    }
    if (
      jobNamespace !== undefined &&
      contextNamespace !== undefined &&
      jobNamespace !== contextNamespace
    ) {
      issues.push({
        path: "job.namespace",
        message: "Job namespace must match Context namespace when both are set",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
