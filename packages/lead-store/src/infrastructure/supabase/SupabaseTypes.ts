/**
 * A minimal, hand-written structural port over the parts of `@supabase/supabase-js`'s
 * `SupabaseClient` this package actually uses (`.from(table).select/insert/update/eq/...` and
 * `.channel(name).on(...).subscribe()`). Every repository and `RealtimeSubscription` depends on
 * THIS interface, not the real library's type — so tests can inject a hand-rolled mock without
 * fighting the real client's complex generic overloads (Constitution's Dependency Inversion
 * rule). `infrastructure/supabase/SupabaseClient.ts` bridges the real `createClient(...)` result
 * to this port at the single composition boundary.
 */
export interface SupabaseResult<T> {
  readonly data: T | null;
  readonly error: { readonly message: string; readonly code?: string } | null;
}

export interface SupabaseFilterBuilderLike<Row> extends PromiseLike<SupabaseResult<Row[]>> {
  select(columns?: string): SupabaseFilterBuilderLike<Row>;
  eq(column: string, value: unknown): SupabaseFilterBuilderLike<Row>;
  gte(column: string, value: unknown): SupabaseFilterBuilderLike<Row>;
  lte(column: string, value: unknown): SupabaseFilterBuilderLike<Row>;
  order(column: string, options?: { readonly ascending?: boolean }): SupabaseFilterBuilderLike<Row>;
  limit(count: number): SupabaseFilterBuilderLike<Row>;
  single(): PromiseLike<SupabaseResult<Row>>;
  maybeSingle(): PromiseLike<SupabaseResult<Row | null>>;
}

export interface SupabaseTableClientLike<Row extends object = Record<string, unknown>> {
  select(columns?: string): SupabaseFilterBuilderLike<Row>;
  insert(values: Partial<Row> | ReadonlyArray<Partial<Row>>): SupabaseFilterBuilderLike<Row>;
  update(values: Partial<Row>): SupabaseFilterBuilderLike<Row>;
}

export interface SupabaseRealtimePayload {
  readonly new: Record<string, unknown>;
  readonly old: Record<string, unknown>;
}

export interface SupabaseRealtimeChannelLike {
  on(
    event: "postgres_changes",
    filter: {
      readonly event: string;
      readonly schema: string;
      readonly table: string;
      readonly filter?: string;
    },
    callback: (payload: SupabaseRealtimePayload) => void,
  ): SupabaseRealtimeChannelLike;
  subscribe(callback?: (status: string) => void): SupabaseRealtimeChannelLike;
  unsubscribe(): Promise<"ok" | "timed out" | "error">;
}

export interface SupabaseClientLike {
  from<Row extends object = Record<string, unknown>>(table: string): SupabaseTableClientLike<Row>;
  channel(name: string): SupabaseRealtimeChannelLike;
}
