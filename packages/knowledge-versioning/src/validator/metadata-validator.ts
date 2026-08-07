import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";
import { knowledgeVersionMetadataSchema } from "../domain/knowledge-version-metadata.js";

/** Stage 2 — Metadata: the whole `KnowledgeVersionMetadata` record must satisfy its Zod schema, and its tenant must match the Context's. */
export class MetadataValidator implements IKnowledgeVersionValidator {
  readonly name = "metadata";

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    const parsed = knowledgeVersionMetadataSchema.safeParse(input.metadata);
    const issues = parsed.success
      ? []
      : parsed.error.issues.map((issue) => ({
          path: `metadata.${issue.path.join(".")}`,
          message: issue.message,
        }));
    if (input.metadata.tenantId !== input.context.tenantId) {
      issues.push({
        path: "metadata.tenantId",
        message: "Version metadata tenantId must match Context tenantId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
