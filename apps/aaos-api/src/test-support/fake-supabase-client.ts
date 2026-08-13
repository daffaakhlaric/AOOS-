import type { SupabaseClientLike } from "@aos/lead-store";

/**
 * A hand-rolled `SupabaseClientLike` test double, shared by every AAOS-W4B spec file that needs
 * to exercise a real `@aos/lead-store` write-through path (`RecordAssignment`, `UpdateLeadStatus`,
 * `RecordClosing`) against real use cases with zero real network calls. Unlike
 * `modules/leads/leads.service.spec.ts`'s original narrower fake (kept as-is for its own file —
 * it never exercises an `.update(...)` call), this one actually PERSISTS `.update(...)` writes by
 * mutating the stored row in place, so a `getLead` call made after a `claimLead`/`updateStatus`
 * call observes the real, updated row — required for AAOS-W4B's claim/status/closing tests.
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

  function builder(table: string, mode: "select" | "insert" | "update", payload?: Row) {
    const filters: Filter[] = [];
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
      order: () => api,
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
        const rows = tableRows(table).filter((row) => matches(row, filters));
        resolve({ data: rows, error: null });
      },
      maybeSingle: async () => {
        const forced = forcedErrors.get(table);
        if (forced !== undefined) {
          forcedErrors.delete(table);
          return { data: null, error: { message: forced } };
        }
        const rows = tableRows(table).filter((row) => matches(row, filters));
        return { data: rows[0] ?? null, error: null };
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
        const rows = tableRows(table).filter((row) => matches(row, filters));
        const target = rows[0];
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
