import type { SupabaseClientLike } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import {
  SimulationRepository,
  SimulationRepositoryError,
  type CreateSimulationInput,
} from "./simulation.repository.js";

/**
 * Minimal hand-rolled fake of `SupabaseClientLike` (same structural port `@aos/lead-store`'s own
 * repository tests fake, just implemented locally since `aaos-api` has no shared test helper for
 * it yet). Stores rows in-memory per table; `forceErrorOnce` makes the NEXT call against a table
 * resolve with a Supabase-shaped error instead of touching the in-memory rows.
 */
function createFakeSupabaseClient(): SupabaseClientLike & {
  rows: (table: string) => readonly Record<string, unknown>[];
  forceErrorOnce: (table: string, message: string) => void;
} {
  const tables = new Map<string, Record<string, unknown>[]>();
  const forcedErrors = new Map<string, string>();

  function tableRows(table: string): Record<string, unknown>[] {
    const existing = tables.get(table);
    if (existing !== undefined) return existing;
    const created: Record<string, unknown>[] = [];
    tables.set(table, created);
    return created;
  }

  return {
    rows: (table: string) => tableRows(table),
    forceErrorOnce: (table: string, message: string) => forcedErrors.set(table, message),
    from<Row extends object>(table: string) {
      function maybeError(): { message: string } | null {
        const message = forcedErrors.get(table);
        if (message !== undefined) {
          forcedErrors.delete(table);
          return { message };
        }
        return null;
      }

      return {
        insert(values: Partial<Row> | ReadonlyArray<Partial<Row>>) {
          const list = Array.isArray(values) ? values : [values];
          const inserted = list.map(
            (v) => ({ id: "generated-id", ...v }) as Record<string, unknown>,
          );
          const rows = tableRows(table);
          rows.push(...inserted);
          return buildFilterBuilder(rows, inserted, maybeError);
        },
        update(values: Partial<Row>) {
          const rows = tableRows(table);
          return buildFilterBuilder(rows, undefined, maybeError, values as Record<string, unknown>);
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
  } as unknown as SupabaseClientLike & {
    rows: (table: string) => readonly Record<string, unknown>[];
    forceErrorOnce: (table: string, message: string) => void;
  };
}

/** Builds a chainable, thenable filter-builder stand-in supporting the subset of the real API this repository actually calls (`eq`/`order`/`limit`/`single`/`maybeSingle`, plain `await`). */
function buildFilterBuilder(
  allRows: Record<string, unknown>[],
  scoped: readonly Record<string, unknown>[] | undefined,
  maybeError: () => { message: string } | null,
  updatePatch?: Record<string, unknown>,
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
    gte(column: string, value: unknown) {
      filtered = filtered.filter((row) => {
        const raw = row[column];
        return typeof raw === "string" && raw >= String(value);
      });
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

const INPUT: CreateSimulationInput = {
  id: "sim-1",
  tenantId: "dss-motor",
  objectiveSnapshot: { targetHotLeads: 10 },
  campaignDataSource: "cache",
  personaIds: ["ready_buyer"],
  branch: "CINERE",
};

describe("SimulationRepository", () => {
  it("create inserts a row and returns the domain shape", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SimulationRepository(client);
    const result = await repo.create(INPUT);
    expect(result.id).toBe("sim-1");
    expect(result.status).toBe("RUNNING");
    expect(result.currentStep).toBe("SETUP");
    expect(client.rows("simulations")).toHaveLength(1);
  });

  it("create throws SimulationRepositoryError on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("simulations", "db down");
    const repo = new SimulationRepository(client);
    await expect(repo.create(INPUT)).rejects.toThrow(SimulationRepositoryError);
  });

  it("findById returns undefined for an unknown id", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SimulationRepository(client);
    expect(await repo.findById("missing")).toBeUndefined();
  });

  it("findById returns the domain shape for a known id", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SimulationRepository(client);
    await repo.create(INPUT);
    const found = await repo.findById("sim-1");
    expect(found?.id).toBe("sim-1");
    expect(found?.branch).toBe("CINERE");
  });

  it("list returns every row, most-recent-first shape preserved from the client", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SimulationRepository(client);
    await repo.create(INPUT);
    const list = await repo.list();
    expect(list).toHaveLength(1);
  });

  it("updateStep/complete/fail/recordDecision update the row in place", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SimulationRepository(client);
    await repo.create(INPUT);

    await repo.updateStep("sim-1", "TAMARA");
    expect((await repo.findById("sim-1"))?.currentStep).toBe("TAMARA");

    await repo.complete("sim-1", {
      tamara: { available: true, elapsedMs: 1, coverageScore: 100 },
      kai: { available: true, elapsedMs: 1, videoGenerated: false, note: "n" },
      jessy: { available: true, runs: [], elapsedMs: 1 },
      scoring: {
        tamaraCoverageScore: 100,
        kaiScore: 100,
        jessyScore: 0,
        overallScore: 40,
        grade: "D",
        verdict: "INCOMPLETE",
      },
    });
    const done = await repo.findById("sim-1");
    expect(done?.status).toBe("DONE");
    expect(done?.result?.scoring.grade).toBe("D");

    await repo.recordDecision("sim-1", "APPROVED", "manager-1", "ok", "2026-08-13T00:00:00.000Z");
    const decided = await repo.findById("sim-1");
    expect(decided?.decision).toBe("APPROVED");
    expect(decided?.decidedBy).toBe("manager-1");
  });

  it("fail records an error message and ERROR status", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SimulationRepository(client);
    await repo.create(INPUT);
    await repo.fail("sim-1", "boom");
    const failed = await repo.findById("sim-1");
    expect(failed?.status).toBe("ERROR");
    expect(failed?.errorMessage).toBe("boom");
  });

  it("appendLog + listLogs round-trip real log entries", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SimulationRepository(client);
    await repo.create(INPUT);
    await repo.appendLog("sim-1", {
      step: "TAMARA",
      level: "INFO",
      message: "hello",
      createdAt: "2026-08-13T00:00:00.000Z",
    });
    const logs = await repo.listLogs("sim-1");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.message).toBe("hello");
  });

  describe("AAOS-GO-LIVE additions", () => {
    it("markLive sets status=LIVE and the real campaign/ad/rollback ids", async () => {
      const client = createFakeSupabaseClient();
      const repo = new SimulationRepository(client);
      await repo.create(INPUT);
      await repo.markLive("sim-1", "campaign-1", "ad-1", "2026-08-13T10:00:00.000Z", {
        newCampaignId: "campaign-1",
        newAdSetId: "adset-1",
        newAdId: "ad-1",
        mutatedEntities: [],
      });
      const live = await repo.findById("sim-1");
      expect(live?.status).toBe("LIVE");
      expect(live?.liveCampaignId).toBe("campaign-1");
      expect(live?.liveAdId).toBe("ad-1");
      expect(live?.liveAt).toBe("2026-08-13T10:00:00.000Z");
      expect(live?.rollbackData?.newAdSetId).toBe("adset-1");
    });

    it("markRolledBack sets status=ROLLED_BACK and rolledBackAt", async () => {
      const client = createFakeSupabaseClient();
      const repo = new SimulationRepository(client);
      await repo.create(INPUT);
      await repo.markLive("sim-1", "campaign-1", "ad-1", "2026-08-13T10:00:00.000Z", {
        newCampaignId: "campaign-1",
        newAdSetId: "adset-1",
        newAdId: "ad-1",
        mutatedEntities: [],
      });
      await repo.markRolledBack("sim-1", "2026-08-13T11:00:00.000Z");
      const rolledBack = await repo.findById("sim-1");
      expect(rolledBack?.status).toBe("ROLLED_BACK");
      expect(rolledBack?.rolledBackAt).toBe("2026-08-13T11:00:00.000Z");
    });

    it("hasLiveSince returns false when no LIVE row exists on/after the given timestamp", async () => {
      const client = createFakeSupabaseClient();
      const repo = new SimulationRepository(client);
      await repo.create(INPUT);
      expect(await repo.hasLiveSince("2026-08-13T00:00:00.000Z")).toBe(false);
    });

    it("hasLiveSince returns true once a LIVE row's live_at is on/after the given timestamp", async () => {
      const client = createFakeSupabaseClient();
      const repo = new SimulationRepository(client);
      await repo.create(INPUT);
      await repo.markLive("sim-1", "campaign-1", "ad-1", "2026-08-13T10:00:00.000Z", {
        newCampaignId: "campaign-1",
        newAdSetId: "adset-1",
        newAdId: "ad-1",
        mutatedEntities: [],
      });
      expect(await repo.hasLiveSince("2026-08-13T00:00:00.000Z")).toBe(true);
      expect(await repo.hasLiveSince("2026-08-14T00:00:00.000Z")).toBe(false);
    });

    it("listLive returns only LIVE rows", async () => {
      const client = createFakeSupabaseClient();
      const repo = new SimulationRepository(client);
      await repo.create(INPUT);
      await repo.create({ ...INPUT, id: "sim-2" });
      await repo.markLive("sim-1", "campaign-1", "ad-1", "2026-08-13T10:00:00.000Z", {
        newCampaignId: "campaign-1",
        newAdSetId: "adset-1",
        newAdId: "ad-1",
        mutatedEntities: [],
      });
      const live = await repo.listLive();
      expect(live).toHaveLength(1);
      expect(live[0]?.id).toBe("sim-1");
    });
  });
});
