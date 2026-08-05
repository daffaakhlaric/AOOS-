import { AssetNotFoundException } from "../errors/asset-not-found-exception.js";
import { DuplicateAssetException } from "../errors/duplicate-asset-exception.js";

import type { KnowledgeRegistryBucket } from "./knowledge-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "REGISTRY: Registry for Schemas, Templates, Categories, Policies, Providers,
 * Namespaces, Relationships, Libraries, Collections, Versions." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md).
 * One generic, in-memory, id-keyed store per `KnowledgeRegistryBucket` — the canonical
 * place every cross-cutting reference-data entry lives, so `policy/`/`relationship/`/
 * `version/`/`template/knowledge-*-engine.ts` never maintain a second, duplicate store.
 */
export class KnowledgeRegistry {
  private readonly buckets = new Map<KnowledgeRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateAssetException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T extends Identified>(bucket: KnowledgeRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T extends Identified>(bucket: KnowledgeRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new AssetNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T extends Identified>(bucket: KnowledgeRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
