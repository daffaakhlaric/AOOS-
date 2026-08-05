import type { KnowledgeRuntimeCacheReference } from "../domain/knowledge-runtime-cache-reference.js";

/** Interface only — no implementation in this package. A future cache tier (e.g. Redis-backed) reads/writes runtime state keyed by `cacheKey`. */
export interface IKnowledgeRuntimeCache {
  get(cacheKey: string): Promise<Readonly<Record<string, unknown>> | undefined>;
  set(
    cacheKey: string,
    value: Readonly<Record<string, unknown>>,
    ttlMs?: number,
  ): Promise<KnowledgeRuntimeCacheReference>;
  invalidate(cacheKey: string): Promise<void>;
}
