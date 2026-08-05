import { DuplicateSourceEntryException } from "../errors/duplicate-source-entry-exception.js";
import { SourceNotFoundException } from "../errors/source-not-found-exception.js";

import type { KnowledgeSourceRegistryBucket } from "./knowledge-source-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "SOURCE REGISTRY: Register Sources, Categories, Namespaces, Collections, Policies,
 * Permissions, Statistics, Sessions, Health." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md)
 * — one generic, in-memory, id-keyed store per `KnowledgeSourceRegistryBucket`.
 */
export class KnowledgeSourceRegistry {
  private readonly buckets = new Map<KnowledgeSourceRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeSourceRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateSourceEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeSourceRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: KnowledgeSourceRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: KnowledgeSourceRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new SourceNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeSourceRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: KnowledgeSourceRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeSourceRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeSourceRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
