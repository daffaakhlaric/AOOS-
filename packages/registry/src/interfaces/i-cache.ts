/** Generic TTL-based cache port — one implementation (cache/ttl-cache.ts) backs Registry/Metadata/Schema/Validation caches. */
export interface ICache<TValue> {
  get(key: string): TValue | undefined;
  set(key: string, value: TValue, ttlMs?: number): void;
  has(key: string): boolean;
  invalidate(key: string): void;
  clear(): void;
  readonly hitCount: number;
  readonly missCount: number;
  readonly size: number;
}
