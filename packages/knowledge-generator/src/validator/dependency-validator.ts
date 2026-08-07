import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";
import { KnowledgeGenerationMode } from "../domain/knowledge-generation-mode.js";

/**
 * Stage 10 — Dependency: cross-field structural dependency checks, e.g. every
 * non-`Custom` Generation Mode requires a Prompt Reference — a real dependency rule
 * between two fields of the same Request, distinct from Stage 4/5's simple
 * resolvability checks.
 */
export class DependencyValidator implements IKnowledgeGeneratorValidator {
  readonly name = "dependency";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (input.request.mode !== KnowledgeGenerationMode.CUSTOM && !input.request.promptReferenceId) {
      issues.push({
        path: "request.promptReferenceId",
        message: `Generation Mode "${input.request.mode}" requires a Prompt Reference`,
      });
    }
    /* A referenced Policy with `requireApproval` and no Configuration is a common
     * misconfiguration in production — flagged only when a Policy was actually
     * resolved (so this stage stays a pure function of its input). */
    if (input.policy?.requireApproval && !input.configuration) {
      issues.push({
        path: "request.configurationId",
        message: `Policy "${input.request.policyId}" requires approval — a Configuration record is required`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
