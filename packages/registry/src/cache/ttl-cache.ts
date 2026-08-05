import type { ICache } from "../interfaces/i-cache.js";
import { now } from "../utils/timing.js";

interface CacheRecord<TValue> {
  readonly value: TValue;
  readonly expiresAt: number | undefined;
}

/**
 * Generic TTL-based in-memory cache. One class backs every cache the Registry System needs
 * (Registry Cache, Metadata Cache, Schema Cache, Validation Cache — docs/PROMPT-005.3-REGISTRY-SYSTEM.md) —
 * they differ only in what value type they're instantiated with, not in behavior.
 */
export class TtlCache<TValue> implements ICache<TValue> {
  private readonly store = new Map<string, CacheRecord<TValue>>();
  private _hitCount = 0;
  private _missCount = 0;

  constructor(private readonly defaultTtlMs?: number) {}

  get(key: string): TValue | undefined {
    const record = this.store.get(key);
    if (!record) {
      this._missCount += 1;
      return undefined;
    }
    if (record.expiresAt !== undefined && record.expiresAt <= now()) {
      this.store.delete(key);
      this._missCount += 1;
      return undefined;
    }
    this._hitCount += 1;
    return record.value;
  }

  set(key: string, value: TValue, ttlMs?: number): void {
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;
    this.store.set(key, {
      value,
      expiresAt: effectiveTtl !== undefined ? now() + effectiveTtl : undefined,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this._hitCount = 0;
    this._missCount = 0;
  }

  get hitCount(): number {
    return this._hitCount;
  }

  get missCount(): number {
    return this._missCount;
  }

  get size(): number {
    return this.store.size;
  }
}
