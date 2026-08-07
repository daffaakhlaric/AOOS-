import type { KnowledgeSimilarityEngine } from "../similarity/knowledge-similarity-engine.js";
import type { KnowledgeItemSnapshot, TagCooccurrenceTable } from "../types/knowledge-item.js";
import { SimilarityClassification } from "../types/similarity-classification.js";

/**
 * Real deterministic tag suggestion: (a) keyword-frequency co-occurrence lookup — for every
 * caller-supplied `keywords` entry on the item, any tags mapped from it in the caller-supplied
 * co-occurrence table are suggested; and (b) tag promotion — any tag carried by an item whose
 * similarity classification (via the shared `KnowledgeSimilarityEngine`) is Related or closer is
 * promoted as a suggestion. Already-present tags are never suggested again.
 */
export class KnowledgeTagSuggestionEngine {
  constructor(private readonly similarityEngine: KnowledgeSimilarityEngine) {}

  suggestFromCooccurrence(
    item: KnowledgeItemSnapshot,
    table: TagCooccurrenceTable,
  ): readonly string[] {
    const existing = new Set(item.tags.map((t) => t.toLowerCase()));
    const suggestions = new Set<string>();
    for (const keyword of item.keywords ?? []) {
      const candidates = table[keyword.toLowerCase()] ?? [];
      for (const tag of candidates) {
        if (!existing.has(tag.toLowerCase())) suggestions.add(tag);
      }
    }
    return [...suggestions];
  }

  suggestFromSimilarItems(
    item: KnowledgeItemSnapshot,
    corpus: readonly KnowledgeItemSnapshot[],
  ): readonly string[] {
    const existing = new Set(item.tags.map((t) => t.toLowerCase()));
    const suggestions = new Set<string>();
    for (const other of corpus) {
      if (other.id === item.id) continue;
      const entry = this.similarityEngine.compare(item, other);
      if (entry.classification === SimilarityClassification.Distinct) continue;
      for (const tag of other.tags) {
        if (!existing.has(tag.toLowerCase())) suggestions.add(tag);
      }
    }
    return [...suggestions];
  }
}
