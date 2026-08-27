import type { SupabaseClientLike } from "@aos/lead-store";

/**
 * A hand-rolled `SupabaseClientLike` test double, shared by every AAOS-W4B spec file that needs
 * to exercise a real `@aos/lead-store` write-through path (`RecordAssignment`, `UpdateLeadStatus`,
 * `RecordClosing`) against real use cases with zero real network calls. Unlike
 * `modules/leads/leads.service.spec.ts`'s original narrower fake (kept as-is for its own file —
 * it never exercises an `.update(...)` call), this one actually PERSISTS `.update(...)` writes by
 * mutating the stored row in place, so a `getLead` call made after a `claimLead`/`updateStatus`
 * call observes the real, updated row — required for AAOS-W4B's claim/status/closing tests.
 *
 * AAOS-CREATIVE-REVIEW extended it (additively) with the three behaviours
 * `modules/creative-packages`' repositories exercise and no earlier caller did: a real `order(...)`
 * sort, `limit(...)`, and applying an `.update(...)` payload on the AWAITED (non-`.single()`) path,
 * which is how `CreativePackageRepository.patch` writes.
 *
 * AAOS-KALENDER-AKTIVITAS extended it (additively) with `.delete()` — `CalendarEventRepository`
 * is the first repository that needs a real row delete (see its own docstring for why the shared
 * `SupabaseClientLike` port deliberately doesn't declare `.delete()`).
 *
 * AAOS-MULTI-TENANT-PHASE1C extended it (additively) with `.upsert()` — `AdTenantIndexRepository`
 * is the first repository that needs a real batched upsert (see its own docstring for why the
 * shared `SupabaseClientLike` port deliberately doesn't declare `.upsert()`). Real
 * insert-or-update-by-conflict-column semantics: a value whose conflict-column matches an existing
 * row is merged into it in place; otherwise a new row is appended.
 */
export type Row = Record<string, unknown>;

export interface FakeSupabaseClient extends SupabaseClientLike {
  seed(table: string, row: Row): void;
  rows(table: string): readonly Row[];
  forceErrorOnce(table: string, message: string): void;
}

type FilterOp = "eq" | "gte" | "lte";
interface Filter {
  readonly column: string;
  readonly op: FilterOp;
  readonly value: unknown;
}

function matches(row: Row, filters: readonly Filter[]): boolean {
  return filters.every(({ column, op, value }) => {
    const cell = row[column];
    if (op === "eq") {
      return cell === value;
    }
    if (op === "gte") {
      return (cell as string) >= (value as string);
    }
    return (cell as string) <= (value as string);
  });
}

export function createFakeSupabaseClient(): FakeSupabaseClient {
  const tables = new Map<string, Row[]>();
  const forcedErrors = new Map<string, string>();

  function tableRows(table: string): Row[] {
    const existing = tables.get(table);
    if (existing !== undefined) {
      return existing;
    }
    const created: Row[] = [];
    tables.set(table, created);
    return created;
  }

  function builder(table: string, mode: "select" | "insert" | "update" | "delete", payload?: Row) {
    const filters: Filter[] = [];
    let orderBy: { readonly column: string; readonly ascending: boolean } | undefined;
    let maxRows: number | undefined;

    function query(): Row[] {
      let rows = tableRows(table).filter((row) => matches(row, filters));
      if (orderBy !== undefined) {
        const { column, ascending } = orderBy;
        rows = [...rows].sort((a, b) => {
          const comparison = String(a[column] ?? "").localeCompare(String(b[column] ?? ""));
          return ascending ? comparison : -comparison;
        });
      }
      return maxRows === undefined ? rows : rows.slice(0, maxRows);
    }

    const api = {
      select: () => api,
      eq: (column: string, value: unknown) => {
        filters.push({ column, op: "eq", value });
        return api;
      },
      gte: (column: string, value: unknown) => {
        filters.push({ column, op: "gte", value });
        return api;
      },
      lte: (column: string, value: unknown) => {
        filters.push({ column, op: "lte", value });
        return api;
      },
      order: (column: string, options?: { readonly ascending?: boolean }) => {
        orderBy = { column, ascending: options?.ascending ?? true };
        return api;
      },
      limit: (count: number) => {
        maxRows = count;
        return api;
      },
      then: (
        resolve: (result: { data: Row[] | null; error: { message: string } | null }) => void,
      ) => {
        const forced = forcedErrors.get(table);
        if (forced !== undefined) {
          forcedErrors.delete(table);
          resolve({ data: null, error: { message: forced } });
          return;
        }
        if (mode === "insert" && payload !== undefined) {
          const row = { ...payload };
          tableRows(table).push(row);
          resolve({ data: [row], error: null });
          return;
        }
        const rows = query();
        if (mode === "update" && payload !== undefined) {
          for (const row of rows) {
            Object.assign(row, payload);
          }
        }
        if (mode === "delete") {
          const remaining = tableRows(table).filter((row) => !rows.includes(row));
          tables.set(table, remaining);
        }
        resolve({ data: rows, error: null });
      },
      maybeSingle: async () => {
        const forced = forcedErrors.get(table);
        if (forced !== undefined) {
          forcedErrors.delete(table);
          return { data: null, error: { message: forced } };
        }
        return { data: query()[0] ?? null, error: null };
      },
      single: async () => {
        const forced = forcedErrors.get(table);
        if (forced !== undefined) {
          forcedErrors.delete(table);
          return { data: null, error: { message: forced } };
        }
        if (mode === "insert" && payload !== undefined) {
          const row = { ...payload };
          tableRows(table).push(row);
          return { data: row, error: null };
        }
        const target = query()[0];
        if (target === undefined) {
          return { data: null, error: null };
        }
        if (mode === "update" && payload !== undefined) {
          Object.assign(target, payload);
        }
        return { data: target, error: null };
      },
    };
    return api;
  }

  return {
    from: (table: string) => ({
      select: () => builder(table, "select"),
      insert: (values: Row) => builder(table, "insert", values),
      update: (values: Row) => builder(table, "update", values),
      delete: () => builder(table, "delete"),
      upsert: (values: readonly Row[], options: { readonly onConflict: string }) => {
        const forced = forcedErrors.get(table);
        if (forced !== undefined) {
          forcedErrors.delete(table);
          return Promise.resolve({ error: { message: forced } });
        }
        const conflictColumn = options.onConflict;
        const rows = tableRows(table);
        for (const value of values) {
          const existing = rows.find((row) => row[conflictColumn] === value[conflictColumn]);
          if (existing !== undefined) {
            Object.assign(existing, value);
          } else {
            rows.push({ ...value });
          }
        }
        return Promise.resolve({ error: null });
      },
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }) as never,
      subscribe: () => ({}) as never,
      unsubscribe: async () => "ok" as const,
    }),
    seed: (table: string, row: Row) => {
      tableRows(table).push(row);
    },
    rows: (table: string) => tableRows(table),
    forceErrorOnce: (table: string, message: string) => {
      forcedErrors.set(table, message);
    },
  } as unknown as FakeSupabaseClient;
}
