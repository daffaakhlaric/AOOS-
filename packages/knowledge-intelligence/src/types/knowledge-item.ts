import type { Metadata } from "./common.js";

/**
 * The caller-supplied, structured snapshot of a single knowledge item this package reasons
 * about. This package never parses raw unstructured text itself (no AI/embedding model is
 * available) — every signal it scores, classifies, or compares is a plain structured field the
 * caller (e.g. a knowledge-base host) already computed or extracted.
 */
export interface KnowledgeItemSnapshot {
  readonly id: string;
  readonly title: string;
  /** Caller-assigned category hint, if any (e.g. "reference", "howto"). */
  readonly category?: string;
  /** Tag set used for Jaccard-based similarity/classification. */
  readonly tags: readonly string[];
  /** Free-form keyword set used for tag-suggestion co-occurrence lookups. */
  readonly keywords?: readonly string[];
  /** Optional numeric feature vector used for cosine-based similarity. */
  readonly vector?: readonly number[];
  readonly contentLength: number;
  readonly requiredFieldsPresent: number;
  readonly requiredFieldsTotal: number;
  readonly lastUpdatedAt: number;
  readonly createdAt: number;
  readonly viewCount?: number;
  /** Ids of other items this item is already known to link/reference. */
  readonly linkedItemIds?: readonly string[];
  /** Ids of other items this item is known to conflict with. */
  readonly conflictsWith?: readonly string[];
  readonly hasOwner?: boolean;
  readonly hasSummary?: boolean;
  readonly hasExamples?: boolean;
  readonly metadata?: Metadata;
}

/** A caller-supplied taxonomy coverage entry: a topic and whether it is covered. */
export interface TaxonomyCoverageEntry {
  readonly topic: string;
  readonly covered: boolean;
  readonly itemCount: number;
}

/** A caller-supplied relationship adjacency edge set, keyed by item id. */
export type AdjacencyList = Readonly<Record<string, readonly string[]>>;

/** A caller-supplied keyword -> candidate-tags co-occurrence table. */
export type TagCooccurrenceTable = Readonly<Record<string, readonly string[]>>;
