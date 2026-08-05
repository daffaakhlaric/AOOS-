import type { KnowledgeClassification } from "../domain/knowledge-classification.js";
import type { KnowledgeMetadata } from "../domain/knowledge-metadata.js";
import { KnowledgeValidationException } from "../errors/knowledge-validation-exception.js";

export interface NormalizeMetadataInput {
  readonly tags?: readonly string[];
  readonly keywords?: readonly string[];
  readonly custom?: Readonly<Record<string, unknown>>;
}

/**
 * "KNOWLEDGE METADATA" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — normalizes/validates
 * `KnowledgeMetadata` (trims/dedupes `tags`/`keywords`) and checks a proposed
 * `classification` change against `KnowledgeClassification`'s sensitivity ordering.
 */
export class KnowledgeMetadataEngine {
  /** Trims and de-duplicates `tags`/`keywords`, case-sensitively — the same normalization every `KnowledgeAsset` mutation should apply before persisting Metadata. */
  normalize(metadata: KnowledgeMetadata): KnowledgeMetadata {
    return {
      ...metadata,
      tags: this.dedupe(metadata.tags),
      keywords: this.dedupe(metadata.keywords),
    };
  }

  /** Throws `KnowledgeValidationException` if `confidence` is outside `[0, 1]` — defense in depth alongside the zod schema's own bound. */
  assertValidConfidence(confidence: number | undefined): void {
    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      throw new KnowledgeValidationException(
        `Metadata confidence "${confidence}" must be between 0 and 1`,
      );
    }
  }

  /** Returns whether `metadata.classification` may be reclassified to `next` — a downgrade (to a less sensitive level) is only assumed safe when explicitly `allowDowngrade`. */
  canReclassify(
    current: KnowledgeClassification,
    next: KnowledgeClassification,
    allowDowngrade: boolean,
    rank: Readonly<Record<KnowledgeClassification, number>>,
  ): boolean {
    return allowDowngrade || rank[next] >= rank[current];
  }

  private dedupe(values: readonly string[]): string[] {
    return Array.from(new Set(values));
  }
}
