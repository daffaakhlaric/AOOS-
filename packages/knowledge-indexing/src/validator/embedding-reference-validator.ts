import { knowledgeEmbeddingReferenceSchema } from "../domain/knowledge-embedding-reference.js";

import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";

/** Flags a `context.metadata.embeddingRef` that is present but does not match `knowledgeEmbeddingReferenceSchema` — "Never generate embeddings. Only store references." */
export class EmbeddingReferenceValidator implements IKnowledgeIndexValidatorStage {
  readonly name = "embeddingReference";

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    const embeddingRef = input.context.metadata["embeddingRef"];
    if (embeddingRef === undefined) {
      return { valid: true, issues: [] };
    }
    const result = knowledgeEmbeddingReferenceSchema.safeParse(embeddingRef);
    if (!result.success) {
      return {
        valid: false,
        issues: [
          {
            path: "context.metadata.embeddingRef",
            message: `embeddingRef does not match KnowledgeEmbeddingReference: ${result.error.message}`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
