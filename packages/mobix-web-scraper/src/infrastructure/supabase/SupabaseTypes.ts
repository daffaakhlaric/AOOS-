/**
 * A minimal, hand-written structural port over the parts of `@supabase/supabase-js`'s
 * `SupabaseClient` this package uses for the `scraped_units` table
 * (`.from(table).select/upsert/eq/ilike/order/range/...`). `ScrapedUnitRepository` depends on THIS
 * interface, not the real library's type — so tests can inject a hand-rolled mock without fighting
 * the real client's complex generic overloads (Constitution's Dependency Inversion rule). Mirrors
 * `@aos/asset-library`'s and `@aos/lead-store`'s own `SupabaseTypes.ts`, redefined locally here per
 * Constitution §4.3 (no business module may import another business module's internal/non-public
 * code). `infrastructure/supabase/SupabaseClient.ts` bridges the real `createClient(...)` result to
 * this port at the single composition boundary.
 */
export interface SupabaseResult<T> {
  readonly data: T | null;
  readonly error: { readonly message: string; readonly code?: string } | null;
  /** Populated by Postgrest only when the query asked via `select(columns, { count: "exact" })`. */
  readonly count?: number | null;
}

export interface SupabaseSelectOptions {
  readonly count?: "exact" | "planned" | "estimated";
  readonly head?: boolean;
}

/** Second argument of the real client's `.upsert(values, options)` — only the fields this package uses. */
export interface SupabaseUpsertOptions {
  /** Comma-separated column list forming the conflict target (`scraped_units`' `(tenant_id, identity_key)` unique index). */
  readonly onConflict?: string;
}

export interface SupabaseFilterBuilderLike<Row> extends PromiseLike<SupabaseResult<Row[]>> {
  select(columns?: string, options?: SupabaseSelectOptions): SupabaseFilterBuilderLike<Row>;
  eq(column: string, value: unknown): SupabaseFilterBuilderLike<Row>;
  ilike(column: string, pattern: string): SupabaseFilterBuilderLike<Row>;
  order(column: string, options?: { readonly ascending?: boolean }): SupabaseFilterBuilderLike<Row>;
  limit(count: number): SupabaseFilterBuilderLike<Row>;
  range(from: number, to: number): SupabaseFilterBuilderLike<Row>;
  single(): PromiseLike<SupabaseResult<Row>>;
  maybeSingle(): PromiseLike<SupabaseResult<Row | null>>;
}

export interface SupabaseTableClientLike<Row extends object = Record<string, unknown>> {
  select(columns?: string, options?: SupabaseSelectOptions): SupabaseFilterBuilderLike<Row>;
  upsert(
    values: Partial<Row> | ReadonlyArray<Partial<Row>>,
    options?: SupabaseUpsertOptions,
  ): SupabaseFilterBuilderLike<Row>;
}

export interface SupabaseClientLike {
  from<Row extends object = Record<string, unknown>>(table: string): SupabaseTableClientLike<Row>;
}
