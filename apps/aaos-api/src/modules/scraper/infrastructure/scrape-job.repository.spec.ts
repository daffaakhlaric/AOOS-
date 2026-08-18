import type { SupabaseClientLike } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import {
  ScrapeJobRepository,
  ScrapeJobRepositoryError,
  type CreateScrapeJobInput,
} from "./scrape-job.repository.js";

type Row = Record<string, unknown>;

interface FakeClient extends SupabaseClientLike {
  rows(table: string): readonly Row[];
  forceErrorOnce(table: string, message: string): void;
}

/**
 * Minimal hand-rolled fake of `SupabaseClientLike` — the same local pattern
 * `modules/simulation/infrastructure/simulation.repository.spec.ts` already establishes (this app
 * has no shared helper for this port yet). Rows live in memory per table; `forceErrorOnce` makes
 * the NEXT call against a table resolve with a Supabase-shaped error.
 */
function createFakeSupabaseClient(): FakeClient {
  const tables = new Map<string, Row[]>();
  const forcedErrors = new Map<string, string>();

  function tableRows(table: string): Row[] {
    const existing = tables.get(table);
    if (existing !== undefined) return existing;
    const created: Row[] = [];
    tables.set(table, created);
    return created;
  }

  return {
    rows: (table: string) => tableRows(table),
    forceErrorOnce: (table: string, message: string) => forcedErrors.set(table, message),
    from<R extends object>(table: string) {
      function maybeError(): { message: string } | null {
        const message = forcedErrors.get(table);
        if (message !== undefined) {
          forcedErrors.delete(table);
          return { message };
        }
        return null;
      }
      return {
        insert(values: Partial<R> | ReadonlyArray<Partial<R>>) {
          const list = Array.isArray(values) ? values : [values];
          const inserted = list.map((v) => ({ ...v }) as Row);
          tableRows(table).push(...inserted);
          return buildFilterBuilder(tableRows(table), inserted, maybeError);
        },
        update(values: Partial<R>) {
          return buildFilterBuilder(tableRows(table), undefined, maybeError, values as Row);
        },
        select() {
          const rows = tableRows(table);
          return buildFilterBuilder(rows, rows, maybeError);
        },
      };
    },
    channel() {
      throw new Error("not implemented in fake");
    },
  } as unknown as FakeClient;
}

function buildFilterBuilder(
  allRows: Row[],
  scoped: readonly Row[] | undefined,
  maybeError: () => { message: string } | null,
  updatePatch?: Row,
) {
  let filtered = scoped ?? allRows;
  const builder = {
    select() {
      return builder;
    },
    eq(column: string, value: unknown) {
      filtered = filtered.filter((row) => row[column] === value);
      if (updatePatch !== undefined) {
        for (const row of filtered) {
          Object.assign(row, updatePatch);
        }
      }
      return builder;
    },
    order() {
      return builder;
    },
    limit(count: number) {
      filtered = filtered.slice(0, count);
      return builder;
    },
    async single() {
      const error = maybeError();
      if (error !== null) return { data: null, error };
      return { data: filtered[0] ?? null, error: null };
    },
    async maybeSingle() {
      const error = maybeError();
      if (error !== null) return { data: null, error };
      return { data: filtered[0] ?? null, error: null };
    },
    then(resolve: (value: { data: unknown; error: { message: string } | null }) => void) {
      const error = maybeError();
      if (error !== null) {
        resolve({ data: null, error });
        return;
      }
      resolve({ data: filtered, error: null });
    },
  };
  return builder;
}

const INPUT: CreateScrapeJobInput = {
  id: "job-1",
  tenantId: "dss-motor",
  kind: "FULL",
};

/** The repository selects back the inserted row, so a `create` needs the DB-side defaults present. */
function seedCreatedJob(client: FakeClient, overrides: Row = {}): void {
  const rows = client.rows("scrape_jobs") as Row[];
  rows.push({
    id: "job-seeded",
    tenant_id: "dss-motor",
    kind: "FULL",
    status: "RUNNING",
    unit_url: null,
    branch: null,
    progress_current: 0,
    progress_total: null,
    result: null,
    error_message: null,
    created_at: "2026-08-17T00:00:00.000Z",
    updated_at: "2026-08-17T00:00:00.000Z",
    ...overrides,
  });
}

describe("ScrapeJobRepository.create", () => {
  it("inserts a RUNNING job row and returns the domain shape", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ScrapeJobRepository(client);
    const job = await repo.create(INPUT);
    expect(job.id).toBe("job-1");
    expect(job.status).toBe("RUNNING");
    expect(job.kind).toBe("FULL");
    expect(job.progressCurrent).toBe(0);
    // `progress_total` is deliberately absent until the listing is really parsed.
    expect(job.progressTotal).toBeUndefined();
    expect(client.rows("scrape_jobs")).toHaveLength(1);
  });

  it("records unitUrl/branch for a UNIT job", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ScrapeJobRepository(client);
    const job = await repo.create({
      ...INPUT,
      kind: "UNIT",
      unitUrl: "https://mobixbydss.id/unit/brio-a",
      branch: "CINERE",
    });
    expect(job.kind).toBe("UNIT");
    expect(job.unitUrl).toBe("https://mobixbydss.id/unit/brio-a");
    expect(job.branch).toBe("CINERE");
  });

  it("throws ScrapeJobRepositoryError on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("scrape_jobs", "db down");
    const repo = new ScrapeJobRepository(client);
    await expect(repo.create(INPUT)).rejects.toThrow(ScrapeJobRepositoryError);
  });
});

describe("ScrapeJobRepository.findById / list", () => {
  it("findById returns undefined for an unknown id", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ScrapeJobRepository(client);
    expect(await repo.findById("nope")).toBeUndefined();
  });

  it("findById maps a persisted row (including result JSONB) back to the domain shape", async () => {
    const client = createFakeSupabaseClient();
    seedCreatedJob(client, {
      id: "job-x",
      status: "DONE",
      progress_current: 5,
      progress_total: 5,
      result: { unitsScraped: 5, newUnits: 2, soldUnits: 0, photosStored: 9, photosFailed: 1 },
    });
    const repo = new ScrapeJobRepository(client);
    const job = await repo.findById("job-x");
    expect(job?.status).toBe("DONE");
    expect(job?.progressTotal).toBe(5);
    expect(job?.result?.photosStored).toBe(9);
    expect(job?.result?.photosFailed).toBe(1);
  });

  it("findById throws on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("scrape_jobs", "boom");
    const repo = new ScrapeJobRepository(client);
    await expect(repo.findById("job-x")).rejects.toThrow(ScrapeJobRepositoryError);
  });

  it("list honors the limit", async () => {
    const client = createFakeSupabaseClient();
    seedCreatedJob(client, { id: "a" });
    seedCreatedJob(client, { id: "b" });
    seedCreatedJob(client, { id: "c" });
    const repo = new ScrapeJobRepository(client);
    expect(await repo.list(2)).toHaveLength(2);
  });

  it("list throws on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("scrape_jobs", "boom");
    const repo = new ScrapeJobRepository(client);
    await expect(repo.list()).rejects.toThrow(ScrapeJobRepositoryError);
  });
});

describe("ScrapeJobRepository mutations", () => {
  it("updateProgress writes the real counters", async () => {
    const client = createFakeSupabaseClient();
    seedCreatedJob(client, { id: "job-x" });
    const repo = new ScrapeJobRepository(client);
    await repo.updateProgress("job-x", 3, 10);
    const job = await repo.findById("job-x");
    expect(job?.progressCurrent).toBe(3);
    expect(job?.progressTotal).toBe(10);
  });

  it("updateProgress leaves progress_total untouched when no total is supplied", async () => {
    const client = createFakeSupabaseClient();
    seedCreatedJob(client, { id: "job-x", progress_total: 8 });
    const repo = new ScrapeJobRepository(client);
    await repo.updateProgress("job-x", 4);
    const job = await repo.findById("job-x");
    expect(job?.progressTotal).toBe(8);
  });

  it("complete sets DONE plus the measured result", async () => {
    const client = createFakeSupabaseClient();
    seedCreatedJob(client, { id: "job-x" });
    const repo = new ScrapeJobRepository(client);
    await repo.complete("job-x", {
      unitsScraped: 4,
      newUnits: 1,
      soldUnits: 0,
      photosStored: 6,
      photosFailed: 0,
      unitsPersisted: 4,
    });
    const job = await repo.findById("job-x");
    expect(job?.status).toBe("DONE");
    expect(job?.result?.unitsPersisted).toBe(4);
  });

  it("fail sets ERROR plus the message", async () => {
    const client = createFakeSupabaseClient();
    seedCreatedJob(client, { id: "job-x" });
    const repo = new ScrapeJobRepository(client);
    await repo.fail("job-x", "listing returned 503");
    const job = await repo.findById("job-x");
    expect(job?.status).toBe("ERROR");
    expect(job?.errorMessage).toBe("listing returned 503");
  });

  it("each mutation throws ScrapeJobRepositoryError on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ScrapeJobRepository(client);

    client.forceErrorOnce("scrape_jobs", "boom");
    await expect(repo.updateProgress("job-x", 1)).rejects.toThrow(ScrapeJobRepositoryError);
    client.forceErrorOnce("scrape_jobs", "boom");
    await expect(
      repo.complete("job-x", {
        unitsScraped: 0,
        newUnits: 0,
        soldUnits: 0,
        photosStored: 0,
        photosFailed: 0,
      }),
    ).rejects.toThrow(ScrapeJobRepositoryError);
    client.forceErrorOnce("scrape_jobs", "boom");
    await expect(repo.fail("job-x", "x")).rejects.toThrow(ScrapeJobRepositoryError);
  });
});

describe("ScrapeJobRepository logs", () => {
  it("appendLog inserts a row and listLogs reads it back", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ScrapeJobRepository(client);
    await repo.appendLog("job-x", {
      level: "INFO",
      message: "Listing diparse — 48 unit ditemukan.",
      createdAt: "2026-08-17T00:00:01.000Z",
    });
    const logs = await repo.listLogs("job-x");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.level).toBe("INFO");
    expect(logs[0]?.message).toContain("48 unit");
    expect(logs[0]?.createdAt).toBe("2026-08-17T00:00:01.000Z");
  });

  it("listLogs returns [] for a job with no logs", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ScrapeJobRepository(client);
    expect(await repo.listLogs("job-x")).toEqual([]);
  });

  it("appendLog and listLogs each throw on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ScrapeJobRepository(client);
    client.forceErrorOnce("scrape_job_logs", "boom");
    await expect(
      repo.appendLog("job-x", { level: "INFO", message: "m", createdAt: "t" }),
    ).rejects.toThrow(ScrapeJobRepositoryError);
    client.forceErrorOnce("scrape_job_logs", "boom");
    await expect(repo.listLogs("job-x")).rejects.toThrow(ScrapeJobRepositoryError);
  });
});
