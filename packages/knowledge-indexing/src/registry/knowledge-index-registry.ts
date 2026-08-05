import { DuplicateIndexEntryException } from "../errors/duplicate-index-entry-exception.js";
import { IndexNotFoundException } from "../errors/index-not-found-exception.js";

import type { KnowledgeIndexRegistryBucket } from "./knowledge-index-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "REGISTRY: Maintain Indexes, Versions, Namespaces, Templates, Policies, Relationships,
 * Statistics." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — one generic, in-memory,
 * id-keyed store per `KnowledgeIndexRegistryBucket`, mirroring
 * `@aos/knowledge-engine`'s `KnowledgeRegistry`.
 */
export class KnowledgeIndexRegistry {
  private readonly buckets = new Map<KnowledgeIndexRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeIndexRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateIndexEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeIndexRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T extends Identified>(bucket: KnowledgeIndexRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T extends Identified>(bucket: KnowledgeIndexRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new IndexNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeIndexRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T extends Identified>(bucket: KnowledgeIndexRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeIndexRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeIndexRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
