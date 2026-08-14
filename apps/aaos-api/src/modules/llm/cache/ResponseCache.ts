import { createHash } from "node:crypto";

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes, per the spec's "Cache LLM responses for 30 minutes"

/**
 * A tiny in-memory, TTL-expiring cache keyed by a SHA-256 hash of `(namespace, requestBody)` —
 * "same data = same analysis" (spec Section 6). `namespace` (one per endpoint: `"analyze"`,
 * `"creative-brief"`, `"chat"`) keeps identical request bodies sent to different endpoints from
 * colliding on the same cache entry.
 *
 * Deliberately process-local/in-memory, not Redis-backed — this app is a single-process POC
 * (RULE-097's "explicit invalidation strategy" is satisfied here by the TTL itself; entries are
 * never mutated in place, only replaced/expired).
 */
export class ResponseCache<T> {
  private readonly store = new Map<string, { readonly value: T; readonly expiresAt: number }>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    /** Injectable clock, defaulting to real `Date.now` — overridable so tests can assert TTL expiry deterministically without real timers. */
    private readonly now: () => number = Date.now,
  ) {}

  get(namespace: string, requestBody: unknown): T | undefined {
    const key = this.keyFor(namespace, requestBody);
    const entry = this.store.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(namespace: string, requestBody: unknown, value: T): void {
    const key = this.keyFor(namespace, requestBody);
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  private keyFor(namespace: string, requestBody: unknown): string {
    const hash = createHash("sha256").update(JSON.stringify(requestBody)).digest("hex");
    return `${namespace}:${hash}`;
  }
}
