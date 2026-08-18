import type {
  SupabaseClientLike,
  SupabaseFilterBuilderLike,
  SupabaseResult,
  SupabaseSelectOptions,
  SupabaseTableClientLike,
  SupabaseUpsertOptions,
} from "../../src/infrastructure/supabase/SupabaseTypes.js";

type Row = Record<string, unknown>;
interface Filter {
  readonly column: string;
  readonly predicate: (value: unknown) => boolean;
}

/**
 * A minimal, in-memory, hand-rolled `SupabaseClientLike` test double for the `scraped_units`
 * Postgrest table — zero real network calls. Supports the exact subset of the fluent query builder
 * `ScrapedUnitRepository` uses (`select/upsert/eq/ilike/order/limit/range/maybeSingle`, plus
 * `select`'s `{ count: "exact" }` option). `upsert` honors the `onConflict` column list the way
 * Postgres' `ON CONFLICT ... DO UPDATE` does, so idempotency is exercised for real rather than
 * assumed. Mirrors `@aos/asset-library`'s `tests/helpers/supabase.ts`, redefined locally per
 * Constitution §4.3.
 */
export class FakeSupabaseClient implements SupabaseClientLike {
  readonly tables = new Map<string, Row[]>();
  private readonly forcedErrors = new Map<string, { message: string; skip: number }>();

  seed<T extends object>(table: string, rows: readonly T[]): void {
    this.tables.set(
      table,
      rows.map((row) => ({ ...row }) as Row),
    );
  }

  rows(table: string): readonly Row[] {
    return this.tables.get(table) ?? [];
  }

  /** Forces the next (or `skip`-th) operation against `table` to resolve with a Postgrest error. */
  forceErrorOnce(table: string, message: string, skip = 0): void {
    this.forcedErrors.set(table, { message, skip });
  }

  from<R extends object = Row>(table: string): SupabaseTableClientLike<R> {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
    }
    return new FakeTableClient<R>(table, this) as unknown as SupabaseTableClientLike<R>;
  }

  /** @internal */
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

  /** @internal */
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

  upsert(
    values: Partial<R> | ReadonlyArray<Partial<R>>,
    options?: SupabaseUpsertOptions,
  ): FakeQueryBuilder<R> {
    const builder = new FakeQueryBuilder<R>(this.table, this.client, "upsert");
    builder.setUpsert(
      (Array.isArray(values) ? values : [values]) as Row[],
      options?.onConflict?.split(",").map((column) => column.trim()) ?? [],
    );
    return builder;
  }
}

class FakeQueryBuilder<R extends object> implements SupabaseFilterBuilderLike<R> {
  private readonly filters: Filter[] = [];
  private upsertValues: Row[] = [];
  private conflictColumns: string[] = [];
  private orderSpec: { column: string; ascending: boolean } | undefined;
  private countRequested = false;
  private limitCount: number | undefined;
  private rangeSpec: { from: number; to: number } | undefined;

  constructor(
    private readonly table: string,
    private readonly client: FakeSupabaseClient,
    private readonly mode: "select" | "upsert",
  ) {}

  setUpsert(values: Row[], conflictColumns: string[]): void {
    this.upsertValues = values;
    this.conflictColumns = conflictColumns;
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

    const store = this.client.tableRows(this.table);

    if (this.mode === "upsert") {
      const written: Row[] = [];
      for (const incoming of this.upsertValues) {
        const existingIndex =
          this.conflictColumns.length > 0
            ? store.findIndex((row) =>
                this.conflictColumns.every((column) => row[column] === incoming[column]),
              )
            : -1;
        if (existingIndex >= 0) {
          store[existingIndex] = { ...store[existingIndex], ...incoming };
          written.push(store[existingIndex]!);
        } else {
          const created = { ...incoming };
          store.push(created);
          written.push(created);
        }
      }
      return Promise.resolve({ data: written as unknown as R[], error: null });
    }

    let matching = store.filter((row) => matchesFilters(row, this.filters));
    if (this.orderSpec !== undefined) {
      const { column, ascending } = this.orderSpec;
      matching = [...matching].sort((a, b) => {
        const cmp = String(a[column]).localeCompare(String(b[column]));
        return ascending ? cmp : -cmp;
      });
    }
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
