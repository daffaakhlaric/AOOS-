/**
 * A minimal, hand-written structural port over the parts of `@supabase/supabase-js`'s
 * `SupabaseClient` this package uses for the `assets` metadata table
 * (`.from(table).select/insert/update/eq/order/...`). Every repository depends on THIS interface,
 * not the real library's type — so tests can inject a hand-rolled mock without fighting the real
 * client's complex generic overloads (Constitution's Dependency Inversion rule). Mirrors
 * `@aos/lead-store`'s `SupabaseTypes.ts`, redefined locally here per Constitution §4.3 (no business
 * module may import another business module's internal/non-public code).
 * `infrastructure/supabase/SupabaseClient.ts` bridges the real `createClient(...)` result to this
 * port at the single composition boundary.
 *
 * AAOS-SCRAPER-ASSET-LIBRARY additions: `count`/`ilike`/`in`/`range`/`limit` and `select`'s second
 * `options` argument, all needed by `AssetRepository.listAssets`/`getStats`'s paginated,
 * multi-filter queries (Postgrest's `.select("*", { count: "exact" })` + `.range(from, to)` paging
 * idiom). Every one of these is a real method/option on the live `@supabase/supabase-js` filter
 * builder — this port only ever widens to match the real client, never invents an operation.
 */
export interface SupabaseResult<T> {
  readonly data: T | null;
  readonly error: { readonly message: string; readonly code?: string } | null;
  /**
   * Total row count matching the filters, ignoring `range`/`limit` — populated by Postgrest only
   * when the query asked for it via `select(columns, { count: "exact" })`. `null`/absent otherwise.
   */
  readonly count?: number | null;
}

/** Second argument of the real client's `.select(columns, options)` — only the fields this package uses. */
export interface SupabaseSelectOptions {
  readonly count?: "exact" | "planned" | "estimated";
  readonly head?: boolean;
}

export interface SupabaseFilterBuilderLike<Row> extends PromiseLike<SupabaseResult<Row[]>> {
  select(columns?: string, options?: SupabaseSelectOptions): SupabaseFilterBuilderLike<Row>;
  eq(column: string, value: unknown): SupabaseFilterBuilderLike<Row>;
  in(column: string, values: readonly unknown[]): SupabaseFilterBuilderLike<Row>;
  /** Case-insensitive `LIKE` — used for the Asset Library page's free-text search. */
  ilike(column: string, pattern: string): SupabaseFilterBuilderLike<Row>;
  order(column: string, options?: { readonly ascending?: boolean }): SupabaseFilterBuilderLike<Row>;
  limit(count: number): SupabaseFilterBuilderLike<Row>;
  /** Inclusive zero-based row window (Postgrest paging). */
  range(from: number, to: number): SupabaseFilterBuilderLike<Row>;
  single(): PromiseLike<SupabaseResult<Row>>;
  maybeSingle(): PromiseLike<SupabaseResult<Row | null>>;
}

export interface SupabaseTableClientLike<Row extends object = Record<string, unknown>> {
  select(columns?: string, options?: SupabaseSelectOptions): SupabaseFilterBuilderLike<Row>;
  insert(values: Partial<Row> | ReadonlyArray<Partial<Row>>): SupabaseFilterBuilderLike<Row>;
  update(values: Partial<Row>): SupabaseFilterBuilderLike<Row>;
}

export interface SupabaseClientLike {
  from<Row extends object = Record<string, unknown>>(table: string): SupabaseTableClientLike<Row>;
}
