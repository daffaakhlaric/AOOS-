import type { KnowledgeResult } from "../domain/knowledge-result.js";

/** Interface only — no implementation in this package. A future cache tier reads/writes previously-computed Results keyed by a caller-supplied cache key (e.g. a hash of the Query). */
export interface IKnowledgeCacheProvider {
  get(cacheKey: string): Promise<readonly KnowledgeResult[] | undefined>;
  set(cacheKey: string, results: readonly KnowledgeResult[], ttlMs?: number): Promise<void>;
  invalidate(cacheKey: string): Promise<void>;
}
