import type {
  SupabaseClientLike,
  SupabaseFilterBuilderLike,
  SupabaseResult,
  SupabaseSelectOptions,
  SupabaseTableClientLike,
} from "../../src/infrastructure/supabase/SupabaseTypes.js";

type Row = Record<string, unknown>;
/** `eq`/`in`/`ilike` all reduce to one predicate over a single column. */
interface Filter {
  readonly column: string;
  readonly predicate: (value: unknown) => boolean;
}

/**
 * A minimal, in-memory, hand-rolled `SupabaseClientLike` test double for the `assets` Postgrest
 * table — the mock strategy the spec requires ("mock `@supabase/supabase-js`... zero real network
 * calls"). Supports the exact subset of the fluent query builder `AssetRepository` uses
 * (`select/insert/update/eq/in/ilike/order/limit/range/single/maybeSingle`, plus `select`'s
 * `{ count: "exact" }` option). Mirrors `@aos/lead-store`'s `tests/helpers/supabase.ts`, redefined
 * locally per Constitution §4.3.
 */
export class FakeSupabaseClient implements SupabaseClientLike {
  readonly tables = new Map<string, Row[]>();
  private readonly forcedErrors = new Map<string, { message: string; skip: number }>();
  private readonly forcedNulls = new Set<string>();

  seed<T extends object>(table: string, rows: readonly T[]): void {
    this.tables.set(
      table,
      rows.map((row) => ({ ...row }) as Row),
    );
  }

  rows(table: string): readonly Row[] {
    return this.tables.get(table) ?? [];
  }

  /** Forces an operation against `table` to resolve with `{ data: null, error: { message } }`. See `@aos/lead-store`'s helper for `skip` semantics. */
  forceErrorOnce(table: string, message: string, skip = 0): void {
    this.forcedErrors.set(table, { message, skip });
  }

  /** Forces the NEXT `.single()`/`.maybeSingle()` operation against `table` to resolve with `{ data: [], error: null }` — simulates a legitimate "no row returned" response (e.g. RLS blocking the post-insert select-back). Consumed once. */
  forceNullOnce(table: string): void {
    this.forcedNulls.add(table);
  }

  from<R extends object = Row>(table: string): SupabaseTableClientLike<R> {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
    }
    return new FakeTableClient<R>(table, this) as unknown as SupabaseTableClientLike<R>;
  }

  /** @internal used by `FakeQueryBuilder`. */
  consumeForcedError(table: string): string | undefined {
    const pending = this.forcedErrors.get(table);
    if (pending === undefined) {
      return undefined;
    }
    if (pending.skip > 0) {
      this.forcedErrors.set(table, { ...pending, skip: pending.skip - 1 });
      return undefined;
    }
    this.forcedErrors.delete(table);
    return pending.message;
  }

  /** @internal used by `FakeQueryBuilder`. */
  consumeForcedNull(table: string): boolean {
    if (!this.forcedNulls.has(table)) {
      return false;
    }
    this.forcedNulls.delete(table);
    return true;
  }

  /** @internal used by `FakeQueryBuilder`. */
  tableRows(table: string): Row[] {
    const rows = this.tables.get(table);
    if (rows === undefined) {
      const created: Row[] = [];
      this.tables.set(table, created);
      return created;
    }
    return rows;
  }
}

class FakeTableClient<R extends object> {
  constructor(
    private readonly table: string,
    private readonly client: FakeSupabaseClient,
  ) {}

  select(_columns?: string, options?: SupabaseSelectOptions): FakeQueryBuilder<R> {
    const builder = new FakeQueryBuilder<R>(this.table, this.client, "select");
    builder.setCountRequested(options?.count !== undefined);
    return builder;
  }

  insert(values: Partial<R> | ReadonlyArray<Partial<R>>): FakeQueryBuilder<R> {
    const builder = new FakeQueryBuilder<R>(this.table, this.client, "insert");
    builder.setInsertValues(Array.isArray(values) ? values : [values]);
    return builder;
  }

  update(values: Partial<R>): FakeQueryBuilder<R> {
    const builder = new FakeQueryBuilder<R>(this.table, this.client, "update");
    builder.setUpdateValues(values as Row);
    return builder;
  }
}

class FakeQueryBuilder<R extends object> implements SupabaseFilterBuilderLike<R> {
  private readonly filters: Filter[] = [];
  private insertValues: Row[] = [];
  private updateValues: Row = {};
  private orderSpec: { column: string; ascending: boolean } | undefined;
  private countRequested = false;
  private limitCount: number | undefined;
  private rangeSpec: { from: number; to: number } | undefined;

  constructor(
    private readonly table: string,
    private readonly client: FakeSupabaseClient,
    private readonly mode: "select" | "insert" | "update",
  ) {}

  setInsertValues(values: Row[]): void {
    this.insertValues = values;
  }

  setUpdateValues(values: Row): void {
    this.updateValues = values;
  }

  setCountRequested(requested: boolean): void {
    this.countRequested = requested;
  }

  select(_columns?: string, options?: SupabaseSelectOptions): FakeQueryBuilder<R> {
    if (options?.count !== undefined) {
      this.countRequested = true;
    }
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder<R> {
    this.filters.push({ column, predicate: (actual) => actual === value });
    return this;
  }

  in(column: string, values: readonly unknown[]): FakeQueryBuilder<R> {
    this.filters.push({ column, predicate: (actual) => values.includes(actual) });
    return this;
  }

  /** Mirrors Postgrest `ilike`: `%` is the only wildcard, matching is case-insensitive. */
  ilike(column: string, pattern: string): FakeQueryBuilder<R> {
    const needle = pattern.replaceAll("%", "").toLowerCase();
    this.filters.push({
      column,
      predicate: (actual) =>
        String(actual ?? "")
          .toLowerCase()
          .includes(needle),
    });
    return this;
  }

  /** Mirrors Postgrest `IS` — the real null-check operator (`eq` does not reliably match NULL). */
  is(column: string, value: null): FakeQueryBuilder<R> {
    this.filters.push({ column, predicate: (actual) => actual === value });
    return this;
  }

  /** Mirrors Postgrest `NOT` — only the `is` operator is exercised by this package today. */
  not(column: string, operator: string, value: unknown): FakeQueryBuilder<R> {
    if (operator !== "is") {
      throw new Error(`FakeQueryBuilder.not: unsupported operator "${operator}"`);
    }
    this.filters.push({ column, predicate: (actual) => actual !== value });
    return this;
  }

  order(column: string, options?: { readonly ascending?: boolean }): FakeQueryBuilder<R> {
    this.orderSpec = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number): FakeQueryBuilder<R> {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number): FakeQueryBuilder<R> {
    this.rangeSpec = { from, to };
    return this;
  }

  single(): PromiseLike<SupabaseResult<R>> {
    return this.resolveRows().then((result): SupabaseResult<R> => {
      if (result.error !== null) {
        return { data: null, error: result.error };
      }
      const [first] = result.data ?? [];
      return { data: (first as R | undefined) ?? null, error: null };
    });
  }

  maybeSingle(): PromiseLike<SupabaseResult<R | null>> {
    return this.resolveRows().then((result): SupabaseResult<R | null> => {
      if (result.error !== null) {
        return { data: null, error: result.error };
      }
      const [first] = result.data ?? [];
      return { data: (first as R | undefined) ?? null, error: null };
    });
  }

  then<TResult1 = SupabaseResult<R[]>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResult<R[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.resolveRows().then(onfulfilled, onrejected);
  }

  private resolveRows(): Promise<SupabaseResult<R[]>> {
    const forcedError = this.client.consumeForcedError(this.table);
    if (forcedError !== undefined) {
      return Promise.resolve({ data: null, error: { message: forcedError } });
    }

    if (this.client.consumeForcedNull(this.table)) {
      return Promise.resolve({ data: [], error: null });
    }

    const store = this.client.tableRows(this.table);

    if (this.mode === "insert") {
      const inserted = this.insertValues.map((row) => ({ ...row }));
      store.push(...inserted);
      return Promise.resolve({ data: inserted as unknown as R[], error: null });
    }

    if (this.mode === "update") {
      const matching = store.filter((row) => matchesFilters(row, this.filters));
      for (const row of matching) {
        Object.assign(row, this.updateValues);
      }
      return Promise.resolve({ data: matching as unknown as R[], error: null });
    }

    let matching = store.filter((row) => matchesFilters(row, this.filters));
    if (this.orderSpec !== undefined) {
      const { column, ascending } = this.orderSpec;
      matching = [...matching].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        const cmp = String(av).localeCompare(String(bv));
        return ascending ? cmp : -cmp;
      });
    }
    // Postgrest's `count` reflects the filtered total BEFORE `range`/`limit` windowing — the whole
    // point of asking for it alongside a paged query.
    const total = matching.length;
    if (this.rangeSpec !== undefined) {
      matching = matching.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
    }
    if (this.limitCount !== undefined) {
      matching = matching.slice(0, this.limitCount);
    }
    return Promise.resolve({
      data: matching as unknown as R[],
      error: null,
      ...(this.countRequested ? { count: total } : {}),
    });
  }
}

function matchesFilters(row: Row, filters: readonly Filter[]): boolean {
  return filters.every(({ column, predicate }) => predicate(row[column]));
}

export function createFakeSupabaseClient(): FakeSupabaseClient {
  return new FakeSupabaseClient();
}
