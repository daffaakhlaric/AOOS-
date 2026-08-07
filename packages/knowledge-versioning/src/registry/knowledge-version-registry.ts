import { DuplicateVersionEntryException } from "../errors/duplicate-version-entry-exception.js";
import { VersionNotFoundException } from "../errors/version-not-found-exception.js";

import type { KnowledgeVersionRegistryBucket } from "./knowledge-version-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "KnowledgeVersionRegistry" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API")
 * — one generic, in-memory, id-keyed store per `KnowledgeVersionRegistryBucket`.
 * "Implement token-based registries. Never scan collections." — every read is a direct
 * Map lookup by id; `list()`/`count()` exist for Metrics/Health sampling only, never for
 * resolution.
 */
export class KnowledgeVersionRegistry {
  private readonly buckets = new Map<KnowledgeVersionRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeVersionRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateVersionEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeVersionRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: KnowledgeVersionRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: KnowledgeVersionRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new VersionNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeVersionRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: KnowledgeVersionRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeVersionRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeVersionRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
