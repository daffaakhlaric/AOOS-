import type { KnowledgeSourceRegistryBucket } from "../registry/knowledge-source-registry-bucket.js";

/** Interface-only shape of `KnowledgeSourceRegistry` — lets a caller supply an alternate (e.g. persisted) Registry implementation. */
export interface IKnowledgeSourceRegistry {
  register<T extends { readonly id: string }>(bucket: KnowledgeSourceRegistryBucket, entry: T): T;
  get<T>(bucket: KnowledgeSourceRegistryBucket, id: string): T | undefined;
  remove(bucket: KnowledgeSourceRegistryBucket, id: string): boolean;
  list<T>(bucket: KnowledgeSourceRegistryBucket): readonly T[];
  count(bucket: KnowledgeSourceRegistryBucket): number;
}
