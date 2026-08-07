import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";

/** Stage 11 — Integrity: cross-record consistency — tenantId must agree across Metadata/Context, and providerType must match between Request and resolved Configuration (when both present). */
export class IntegrityValidator implements IKnowledgeGeneratorValidator {
  readonly name = "integrity";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (input.metadata.tenantId !== input.context.tenantId) {
      issues.push({
        path: "context.tenantId",
        message: "Context tenantId must match Metadata tenantId",
      });
    }
    if (
      input.configuration?.providerType !== undefined &&
      input.configuration.providerType !== input.request.providerType
    ) {
      issues.push({
        path: "configuration.providerType",
        message: "Configuration providerType must match Request providerType",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
