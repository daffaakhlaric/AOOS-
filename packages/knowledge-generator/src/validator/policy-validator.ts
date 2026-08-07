import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";
import { evaluateKnowledgeGenerationPolicy } from "../domain/knowledge-generation-policy.js";

/** Stage 6 — Policy: a resolved Policy must be active and must allow this Request's Knowledge Type / Mode / Provider Type. */
export class PolicyValidator implements IKnowledgeGeneratorValidator {
  readonly name = "policy";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (input.request.policyId && !input.policy) {
      issues.push({
        path: "request.policyId",
        message: `Policy "${input.request.policyId}" does not resolve`,
      });
    }
    if (input.policy) {
      const result = evaluateKnowledgeGenerationPolicy(input.policy, {
        assetType: input.request.assetType,
        mode: input.request.mode,
        providerType: input.request.providerType,
      });
      for (const reason of result.reasons) {
        issues.push({ path: "policy", message: reason });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
