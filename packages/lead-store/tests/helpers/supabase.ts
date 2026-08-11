import { vi } from "vitest";

import type {
  SupabaseClientLike,
  SupabaseFilterBuilderLike,
  SupabaseRealtimeChannelLike,
  SupabaseRealtimePayload,
  SupabaseResult,
  SupabaseTableClientLike,
} from "../../src/infrastructure/supabase/SupabaseTypes.js";

type Row = Record<string, unknown>;
type Filter = readonly [column: string, op: "eq" | "gte" | "lte", value: unknown];

/**
 * A minimal, in-memory, hand-rolled `SupabaseClientLike` test double — the mock strategy the spec
 * requires ("mock `@supabase/supabase-js`... zero real network calls"). Supports the exact
 * subset of the fluent query builder every `@aos/lead-store` repository uses
 * (`select/insert/update/eq/gte/lte/order/single/maybeSingle`), plus a `channel().on().subscribe()`
 * chain for `RealtimeSubscription` tests to fire manually. NOT a general-purpose Postgrest
 * emulator — table-scoped filtering only, no joins/RPC.
 */
export class FakeSupabaseClient implements SupabaseClientLike {
  readonly tables = new Map<string, Row[]>();
  readonly channels = new Map<string, FakeRealtimeChannel>();
  private readonly forcedErrors = new Map<string, { message: string; skip: number }>();
  private readonly forcedNulls = new Map<string, number>();

  /**
   * `<T extends object>` (not `Row` directly) so callers can pass a concrete `LeadRow[]` /
   * `ConversationRow[]` / etc. — those interfaces have no index signature, so TypeScript would
   * otherwise reject them at a `Row[]`-typed parameter ("index signature ... is missing").
   */
  seed<T extends object>(table: string, rows: readonly T[]): void {
    this.tables.set(
      table,
      rows.map((row) => ({ ...row }) as Row),
    );
  }

  rows(table: string): readonly Row[] {
    return this.tables.get(table) ?? [];
  }

  /**
   * Forces an operation against `table` to resolve with `{ data: null, error: { message } }`.
   * By default forces the very NEXT operation; pass `skip` to let that many earlier operations
   * against `table` succeed first (e.g. `skip: 1` forces the SECOND operation — useful for
   * asserting an error surfaces from a later `.update()` after an earlier `.findById()` select
   * already succeeded within the same use case). Consumed once, whichever operation it lands on.
   */
  forceErrorOnce(table: string, message: string, skip = 0): void {
    this.forcedErrors.set(table, { message, skip });
  }

  /** Forces an operation against `table` to resolve with `{ data: null, error: null }` — simulates a `.single()`/`.maybeSingle()` call that legitimately finds no row. See `forceErrorOnce`'s docstring for `skip`. */
  forceNullOnce(table: string, skip = 0): void {
    this.forcedNulls.set(table, skip);
  }

  from<R extends object = Row>(table: string): SupabaseTableClientLike<R> {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
    }
    return new FakeTableClient<R>(table, this) as unknown as SupabaseTableClientLike<R>;
  }

  channel(name: string): SupabaseRealtimeChannelLike {
    const channel = new FakeRealtimeChannel(name);
    this.channels.set(name, channel);
    return channel;
  }

  /** @internal used by `FakeQueryBuilder` to consume a forced error, if any is pending for `table` and its skip counter has reached 0. */
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

  /** @internal used by `FakeQueryBuilder` to consume a forced null, if any is pending for `table` and its skip counter has reached 0. */
  consumeForcedNull(table: string): boolean {
    const skip = this.forcedNulls.get(table);
    if (skip === undefined) {
      return false;
    }
    if (skip > 0) {
      this.forcedNulls.set(table, skip - 1);
      return false;
    }
    this.forcedNulls.delete(table);
    return true;
  }

  /** @internal used by `FakeQueryBuilder` to read/write the backing table array. */
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
  private limitN: number | undefined;

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
    this.filters.push([column, "eq", value]);
    return this;
  }

  gte(column: string, value: unknown): FakeQueryBuilder<R> {
    this.filters.push([column, "gte", value]);
    return this;
  }

  lte(column: string, value: unknown): FakeQueryBuilder<R> {
    this.filters.push([column, "lte", value]);
    return this;
  }

  order(column: string, options?: { readonly ascending?: boolean }): FakeQueryBuilder<R> {
    this.orderSpec = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number): FakeQueryBuilder<R> {
    this.limitN = count;
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
    if (this.limitN !== undefined) {
      matching = matching.slice(0, this.limitN);
    }
    return Promise.resolve({ data: matching as unknown as R[], error: null });
  }
}

function matchesFilters(row: Row, filters: readonly Filter[]): boolean {
  return filters.every(([column, op, value]) => {
    const actual = row[column];
    if (op === "eq") {
      return actual === value;
    }
    if (op === "gte") {
      return String(actual) >= String(value);
    }
    return String(actual) <= String(value);
  });
}

/** A minimal fake Realtime channel — `on()` records the callback, `subscribe()`/`unsubscribe()` are spies, and `fire()` lets tests manually trigger a `postgres_changes` payload. */
export class FakeRealtimeChannel implements SupabaseRealtimeChannelLike {
  private callback: ((payload: SupabaseRealtimePayload) => void) | undefined;
  readonly subscribeSpy = vi.fn();
  readonly unsubscribeSpy = vi.fn(async () => "ok" as const);

  constructor(readonly name: string) {}

  on(
    _event: "postgres_changes",
    _filter: unknown,
    callback: (payload: SupabaseRealtimePayload) => void,
  ): FakeRealtimeChannel {
    this.callback = callback;
    return this;
  }

  subscribe(callback?: (status: string) => void): FakeRealtimeChannel {
    this.subscribeSpy();
    callback?.("SUBSCRIBED");
    return this;
  }

  async unsubscribe(): Promise<"ok" | "timed out" | "error"> {
    return this.unsubscribeSpy();
  }

  /**
   * Test-only: manually fires the registered `postgres_changes` callback. `<T extends object>`
   * (not `SupabaseRealtimePayload` directly) so tests can pass a concrete `{ new: LeadRow, old:
   * object }` literal — `LeadRow` has no index signature, so TypeScript would otherwise reject it
   * at a `Record<string, unknown>`-typed field.
   */
  fire<T extends object>(payload: { readonly new: T; readonly old: object }): void {
    this.callback?.(payload as unknown as SupabaseRealtimePayload);
  }
}

export function createFakeSupabaseClient(): FakeSupabaseClient {
  return new FakeSupabaseClient();
}
