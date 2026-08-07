import { DuplicateGeneratorEntryException } from "../errors/duplicate-generator-entry-exception.js";
import { GeneratorNotFoundException } from "../errors/generator-not-found-exception.js";

import type { KnowledgeGeneratorRegistryBucket } from "./knowledge-generator-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "KnowledgeGeneratorRegistry" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public
 * API") — one generic, in-memory, id-keyed store per `KnowledgeGeneratorRegistryBucket`.
 * "Never scan collections." — every read is a direct Map lookup by id; `list()`/`count()`
 * exist for Metrics/Health sampling only.
 */
export class KnowledgeGeneratorRegistry {
  private readonly buckets = new Map<KnowledgeGeneratorRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeGeneratorRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateGeneratorEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeGeneratorRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: KnowledgeGeneratorRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: KnowledgeGeneratorRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new GeneratorNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeGeneratorRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: KnowledgeGeneratorRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeGeneratorRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeGeneratorRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
