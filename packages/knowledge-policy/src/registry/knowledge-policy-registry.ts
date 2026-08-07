import { DuplicatePolicyEntryException } from "../errors/duplicate-policy-entry-exception.js";
import { PolicyNotFoundException } from "../errors/policy-not-found-exception.js";

import type { KnowledgePolicyRegistryBucket } from "./knowledge-policy-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "KnowledgePolicyRegistry" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * one generic, in-memory, id-keyed store per `KnowledgePolicyRegistryBucket`.
 * "Implement token-based registries. Never scan collections." — every read is a direct
 * Map lookup by id; `list()`/`count()` exist for Metrics/Health sampling only.
 */
export class KnowledgePolicyRegistry {
  private readonly buckets = new Map<KnowledgePolicyRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgePolicyRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicatePolicyEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgePolicyRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: KnowledgePolicyRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: KnowledgePolicyRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new PolicyNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgePolicyRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: KnowledgePolicyRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgePolicyRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgePolicyRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
