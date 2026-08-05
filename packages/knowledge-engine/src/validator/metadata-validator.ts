import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Metadata" — `reviewedAt`/`expiresAt`, when set, must not precede `createdAt`. */
export class MetadataValidator implements IKnowledgeValidatorStage {
  readonly name = "metadata";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const metadata = input.asset?.metadata;
    if (metadata) {
      const createdAt = Date.parse(metadata.createdAt);
      if (metadata.reviewedAt && Date.parse(metadata.reviewedAt) < createdAt) {
        issues.push({
          path: "metadata.reviewedAt",
          message: "reviewedAt cannot precede createdAt",
        });
      }
      if (metadata.expiresAt && Date.parse(metadata.expiresAt) < createdAt) {
        issues.push({ path: "metadata.expiresAt", message: "expiresAt cannot precede createdAt" });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
