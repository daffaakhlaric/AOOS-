import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";
import { KnowledgeGenerationProviderType } from "../domain/knowledge-generation-provider-type.js";

const VALID_PROVIDER_TYPES = new Set<string>(Object.values(KnowledgeGenerationProviderType));

/** Stage 7 — Provider: `providerType` must be one of the 10 enumerated Generation Providers, and — when checked — must resolve to a registered `IKnowledgeGenerationProvider`. */
export class ProviderValidator implements IKnowledgeGeneratorValidator {
  readonly name = "provider";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (!VALID_PROVIDER_TYPES.has(input.request.providerType)) {
      issues.push({
        path: "request.providerType",
        message: "Request providerType must be a known Generation Provider",
      });
    }
    if (input.providerAvailable === false) {
      issues.push({
        path: "request.providerType",
        message: `No IKnowledgeGenerationProvider is registered for Provider Type "${input.request.providerType}"`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
