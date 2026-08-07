import { DuplicateMarketplaceEntryException } from "../errors/duplicate-marketplace-entry-exception.js";
import { MarketplaceNotFoundException } from "../errors/marketplace-not-found-exception.js";

import type { KnowledgeMarketplaceRegistryBucket } from "./knowledge-marketplace-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "KnowledgeMarketplaceRegistry" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Public
 * API") — one generic, in-memory, id-keyed store per `KnowledgeMarketplaceRegistryBucket`.
 * "Never scan collections." — every read is a direct Map lookup by id; `list()`/`count()`
 * exist for Metrics/Health sampling only.
 */
export class KnowledgeMarketplaceRegistry {
  private readonly buckets = new Map<KnowledgeMarketplaceRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeMarketplaceRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateMarketplaceEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeMarketplaceRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: KnowledgeMarketplaceRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: KnowledgeMarketplaceRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new MarketplaceNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeMarketplaceRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: KnowledgeMarketplaceRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeMarketplaceRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeMarketplaceRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
