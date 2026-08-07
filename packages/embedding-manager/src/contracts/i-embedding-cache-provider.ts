import type { EmbeddingCache } from "../domain/embedding-cache.js";

/** "IEmbeddingCacheProvider" — interface ONLY. A caller-supplied cache backend read/written via cache-key references only; this package never stores the cached vector. */
export interface IEmbeddingCacheProvider {
  lookup(cacheKeyReference: string): Promise<EmbeddingCache | undefined>;
  record(cache: EmbeddingCache): Promise<void>;
}
