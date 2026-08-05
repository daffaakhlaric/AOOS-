import { DuplicateSynchronizationEntryException } from "../errors/duplicate-synchronization-entry-exception.js";
import { SynchronizationNotFoundException } from "../errors/synchronization-not-found-exception.js";

import type { KnowledgeSynchronizationRegistryBucket } from "./knowledge-synchronization-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "REGISTRY: Register Synchronization Jobs, Providers, Policies, Schedules, Sessions,
 * Statistics, Health, Lifecycle." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) —
 * one generic, in-memory, id-keyed store per `KnowledgeSynchronizationRegistryBucket`,
 * mirroring `@aos/knowledge-retrieval`'s `KnowledgeRetrievalRegistry`.
 */
export class KnowledgeSynchronizationRegistry {
  private readonly buckets = new Map<
    KnowledgeSynchronizationRegistryBucket,
    Map<string, Identified>
  >();

  register<T extends Identified>(bucket: KnowledgeSynchronizationRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateSynchronizationEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeSynchronizationRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T extends Identified>(
    bucket: KnowledgeSynchronizationRegistryBucket,
    id: string,
  ): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T extends Identified>(bucket: KnowledgeSynchronizationRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new SynchronizationNotFoundException(
        `No entry "${id}" registered in bucket "${bucket}"`,
      );
    }
    return entry;
  }

  remove(bucket: KnowledgeSynchronizationRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T extends Identified>(bucket: KnowledgeSynchronizationRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeSynchronizationRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeSynchronizationRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
