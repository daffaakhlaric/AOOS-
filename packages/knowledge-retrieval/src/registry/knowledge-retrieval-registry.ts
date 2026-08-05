import { DuplicateRetrievalEntryException } from "../errors/duplicate-retrieval-entry-exception.js";
import { RetrievalNotFoundException } from "../errors/retrieval-not-found-exception.js";

import type { KnowledgeRetrievalRegistryBucket } from "./knowledge-retrieval-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "REGISTRY: Registry for Search Strategies, Ranking Strategies, Filters, Policies,
 * Permission Providers, Result Builders, Search Providers."
 * (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — one generic, in-memory, id-keyed store
 * per `KnowledgeRetrievalRegistryBucket`, mirroring `@aos/knowledge-engine`'s
 * `KnowledgeRegistry`.
 */
export class KnowledgeRetrievalRegistry {
  private readonly buckets = new Map<KnowledgeRetrievalRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeRetrievalRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateRetrievalEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeRetrievalRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T extends Identified>(bucket: KnowledgeRetrievalRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T extends Identified>(bucket: KnowledgeRetrievalRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new RetrievalNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeRetrievalRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T extends Identified>(bucket: KnowledgeRetrievalRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeRetrievalRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeRetrievalRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
