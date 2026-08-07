import { DuplicateValidatorEntryException } from "../errors/duplicate-validator-entry-exception.js";
import { ValidatorNotFoundException } from "../errors/validator-not-found-exception.js";

import type { KnowledgeValidatorRegistryBucket } from "./knowledge-validator-registry-bucket.js";

interface Identified {
  readonly id: string;
}

/**
 * "KnowledgeValidatorRegistry" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public
 * API") — one generic, in-memory, id-keyed store per `KnowledgeValidatorRegistryBucket`.
 * "Never scan collections." — every read is a direct Map lookup by id; `list()`/`count()`
 * exist for Metrics/Health sampling only.
 */
export class KnowledgeValidatorRegistry {
  private readonly buckets = new Map<KnowledgeValidatorRegistryBucket, Map<string, Identified>>();

  register<T extends Identified>(bucket: KnowledgeValidatorRegistryBucket, entry: T): T {
    const map = this.bucketMap(bucket);
    if (map.has(entry.id)) {
      throw new DuplicateValidatorEntryException(
        `Entry "${entry.id}" is already registered in bucket "${bucket}"`,
      );
    }
    map.set(entry.id, entry);
    return entry;
  }

  replace<T extends Identified>(bucket: KnowledgeValidatorRegistryBucket, entry: T): T {
    this.bucketMap(bucket).set(entry.id, entry);
    return entry;
  }

  get<T>(bucket: KnowledgeValidatorRegistryBucket, id: string): T | undefined {
    return this.bucketMap(bucket).get(id) as T | undefined;
  }

  require<T>(bucket: KnowledgeValidatorRegistryBucket, id: string): T {
    const entry = this.get<T>(bucket, id);
    if (!entry) {
      throw new ValidatorNotFoundException(`No entry "${id}" registered in bucket "${bucket}"`);
    }
    return entry;
  }

  remove(bucket: KnowledgeValidatorRegistryBucket, id: string): boolean {
    return this.bucketMap(bucket).delete(id);
  }

  list<T>(bucket: KnowledgeValidatorRegistryBucket): readonly T[] {
    return Array.from(this.bucketMap(bucket).values()) as T[];
  }

  count(bucket: KnowledgeValidatorRegistryBucket): number {
    return this.bucketMap(bucket).size;
  }

  private bucketMap(bucket: KnowledgeValidatorRegistryBucket): Map<string, Identified> {
    const existing = this.buckets.get(bucket);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Identified>();
    this.buckets.set(bucket, created);
    return created;
  }
}
