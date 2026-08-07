import { DuplicateEmbeddingEntryException } from "../errors/duplicate-embedding-entry-exception.js";
import { EmbeddingNotFoundException } from "../errors/embedding-not-found-exception.js";

import type { EmbeddingRegistryBucket } from "./embedding-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "EmbeddingRegistry" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Public API") — one
 * generic, in-memory, id-keyed store per `EmbeddingRegistryBucket`. "Never scan
 * collections." — every read is a direct Map lookup by id; `list()`/`count()` exist for
 * Metrics/Health sampling only.
 */
export class EmbeddingRegistry {
  private readonly buckets = new Map<EmbeddingRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: EmbeddingRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateEmbeddingEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: EmbeddingRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: EmbeddingRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: EmbeddingRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new EmbeddingNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: EmbeddingRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: EmbeddingRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: EmbeddingRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: EmbeddingRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
