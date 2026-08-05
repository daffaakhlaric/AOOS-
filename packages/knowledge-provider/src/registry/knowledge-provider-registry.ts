import { DuplicateProviderEntryException } from "../errors/duplicate-provider-entry-exception.js";
import { ProviderNotFoundException } from "../errors/provider-not-found-exception.js";

import type { KnowledgeProviderRegistryBucket } from "./knowledge-provider-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "REGISTRY: Register Providers, Capabilities, Metadata, Categories, Policies, Sessions,
 * Health, Statistics." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — one generic,
 * in-memory, id-keyed store per `KnowledgeProviderRegistryBucket`, mirroring
 * `@aos/knowledge-synchronization`'s `KnowledgeSynchronizationRegistry`.
 */
export class KnowledgeProviderRegistry {
  private readonly buckets = new Map<KnowledgeProviderRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeProviderRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateProviderEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeProviderRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: KnowledgeProviderRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: KnowledgeProviderRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new ProviderNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeProviderRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: KnowledgeProviderRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeProviderRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeProviderRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
