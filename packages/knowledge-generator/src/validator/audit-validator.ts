import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";

/**
 * Stage 12 — Audit: checks that the audit-relevant fields on the Request/Metadata are
 * present and well-formed BEFORE an operation runs (`requestedBy` actor,
 * well-formed `createdAt`). Distinct from the Pipeline's own Audit stage (Stage 9 of
 * the 10-stage Pipeline), which APPENDS the actual `KnowledgeGenerationAudit` entry
 * after the operation completes — this stage is a pre-flight field check, the Pipeline
 * stage is the post-flight side effect. See docs/005.7K-KNOWLEDGE-GENERATOR-AI-REPORT.md
 * — "Validation" for the full distinction (mirrors the Configuration-stage/Validator-
 * stage overlap documented for 005.7F).
 */
export class AuditValidator implements IKnowledgeGeneratorValidator {
  readonly name = "audit";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (input.request.requestedBy.trim().length === 0) {
      issues.push({
        path: "request.requestedBy",
        message: "Request requestedBy (audit actor) must not be empty",
      });
    }
    if (Number.isNaN(Date.parse(input.request.createdAt))) {
      issues.push({
        path: "request.createdAt",
        message: "Request createdAt must be a valid ISO timestamp for audit purposes",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
