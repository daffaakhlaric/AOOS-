import type {
  SupabaseClientLike,
  SupabaseFilterBuilderLike,
  SupabaseResult,
  SupabaseTableClientLike,
} from "../../src/infrastructure/supabase/SupabaseTypes.js";

type Row = Record<string, unknown>;
type Filter = readonly [column: string, value: unknown];

/**
 * A minimal, in-memory, hand-rolled `SupabaseClientLike` test double for the `assets` Postgrest
 * table — the mock strategy the spec requires ("mock `@supabase/supabase-js`... zero real network
 * calls"). Supports the exact subset of the fluent query builder `AssetRepository` uses
 * (`select/insert/update/eq/order/single/maybeSingle`). Mirrors `@aos/lead-store`'s
 * `tests/helpers/supabase.ts`, redefined locally per Constitution §4.3.
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

  select(): FakeQueryBuilder<R> {
    return new FakeQueryBuilder<R>(this.table, this.client, "select");
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

  select(): FakeQueryBuilder<R> {
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder<R> {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { readonly ascending?: boolean }): FakeQueryBuilder<R> {
    this.orderSpec = { column, ascending: options?.ascending ?? true };
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
    return Promise.resolve({ data: matching as unknown as R[], error: null });
  }
}

function matchesFilters(row: Row, filters: readonly Filter[]): boolean {
  return filters.every(([column, value]) => row[column] === value);
}

export function createFakeSupabaseClient(): FakeSupabaseClient {
  return new FakeSupabaseClient();
}
