import { DuplicateEntryException } from "../errors/duplicate-entry-exception.js";

/**
 * Generic id-keyed store shared by all 6 Registry buckets. Backed by a single `Map`, so
 * `register`/`get`/`has`/`remove` are all O(1) — no bucket ever performs a linear scan to answer
 * an id-keyed lookup. (Graph algorithms themselves may scan a *graph's* internal structure for
 * traversal purposes — that is unrelated to Registry lookups and is expected.)
 */
export class RegistryBucket<T> {
  private readonly store = new Map<string, T>();

  constructor(
    private readonly bucketName: string,
    private readonly notFound: (id: string) => Error,
  ) {}

  register(id: string, value: T): T {
    if (this.store.has(id)) {
      throw new DuplicateEntryException(this.bucketName, id);
    }
    this.store.set(id, value);
    return value;
  }

  /** Registers `value`, overwriting any existing entry for `id` (used for update-in-place). */
  put(id: string, value: T): T {
    this.store.set(id, value);
    return value;
  }

  get(id: string): T {
    const value = this.store.get(id);
    if (value === undefined) throw this.notFound(id);
    return value;
  }

  tryGet(id: string): T | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  remove(id: string): boolean {
    return this.store.delete(id);
  }

  list(): T[] {
    return Array.from(this.store.values());
  }

  listIds(): string[] {
    return Array.from(this.store.keys());
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
