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
 */
export interface SupabaseResult<T> {
  readonly data: T | null;
  readonly error: { readonly message: string; readonly code?: string } | null;
}

export interface SupabaseFilterBuilderLike<Row> extends PromiseLike<SupabaseResult<Row[]>> {
  select(columns?: string): SupabaseFilterBuilderLike<Row>;
  eq(column: string, value: unknown): SupabaseFilterBuilderLike<Row>;
  order(column: string, options?: { readonly ascending?: boolean }): SupabaseFilterBuilderLike<Row>;
  single(): PromiseLike<SupabaseResult<Row>>;
  maybeSingle(): PromiseLike<SupabaseResult<Row | null>>;
}

export interface SupabaseTableClientLike<Row extends object = Record<string, unknown>> {
  select(columns?: string): SupabaseFilterBuilderLike<Row>;
  insert(values: Partial<Row> | ReadonlyArray<Partial<Row>>): SupabaseFilterBuilderLike<Row>;
  update(values: Partial<Row>): SupabaseFilterBuilderLike<Row>;
}

export interface SupabaseClientLike {
  from<Row extends object = Record<string, unknown>>(table: string): SupabaseTableClientLike<Row>;
}
