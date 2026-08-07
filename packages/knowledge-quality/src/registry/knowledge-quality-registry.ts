import { DuplicateQualityEntryException } from "../errors/duplicate-quality-entry-exception.js";
import { QualityNotFoundException } from "../errors/quality-not-found-exception.js";

import type { KnowledgeQualityRegistryBucket } from "./knowledge-quality-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "KnowledgeQualityRegistry" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public
 * API") — one generic, in-memory, id-keyed store per `KnowledgeQualityRegistryBucket`.
 * "Never scan collections." — every read is a direct Map lookup by id; `list()`/`count()`
 * exist for Metrics/Health sampling only.
 */
export class KnowledgeQualityRegistry {
  private readonly buckets = new Map<KnowledgeQualityRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeQualityRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateQualityEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeQualityRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: KnowledgeQualityRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: KnowledgeQualityRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new QualityNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeQualityRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: KnowledgeQualityRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeQualityRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeQualityRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
