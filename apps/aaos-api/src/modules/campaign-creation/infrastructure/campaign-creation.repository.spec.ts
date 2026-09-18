import type { SupabaseClientLike } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import {
  CampaignCreationRepository,
  CampaignCreationRepositoryError,
} from "./campaign-creation.repository.js";

const TABLE = "campaign_creation_requests";

interface FakeResult<T> {
  readonly data: T | null;
  readonly error: { readonly message: string; readonly code?: string } | null;
}

/**
 * Minimal, purpose-built fake of `SupabaseClientLike` for this one repository — scoped to exactly
 * the query shapes `CampaignCreationRepository` issues (`.select().eq().eq().eq().maybeSingle()`,
 * `.insert().select().single()`, `.update().eq().eq().select().maybeSingle()`). Not a generic
 * reusable fake (see `simulation.repository.spec.ts`'s own fake for that broader shape) — this one
 * is small enough to hand-write directly and exercises the real race-safety behavior this
 * repository exists for: a `23505` unique-violation on `insert`, and a compare-and-swap `update`
 * that matches zero rows when the `status` guard no longer holds.
 */
function createFakeSupabaseClient(): SupabaseClientLike & {
  seed: (row: Record<string, unknown>) => void;
  rows: () => readonly Record<string, unknown>[];
} {
  const rows: Record<string, unknown>[] = [];
  let nextId = 1;

  function matches(
    row: Record<string, unknown>,
    filters: ReadonlyArray<[string, unknown]>,
  ): boolean {
    return filters.every(([column, value]) => row[column] === value);
  }

  return {
    seed: (row: Record<string, unknown>) => {
      rows.push(row);
    },
    rows: () => rows,
    from<Row extends object>(table: string) {
      if (table !== TABLE) {
        throw new Error(`fake only knows table "${TABLE}", got "${table}"`);
      }
      return {
        select() {
          const filters: Array<[string, unknown]> = [];
          const builder = {
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return builder;
            },
            async maybeSingle(): Promise<FakeResult<Record<string, unknown> | null>> {
              const found = rows.find((r) => matches(r, filters));
              return { data: found ?? null, error: null };
            },
          };
          return builder;
        },
        insert(values: Partial<Row>) {
          const key = ["tenant_id", "growth_objective_id", "listing_id"] as const;
          const conflict = rows.some((r) =>
            key.every((k) => r[k] === (values as Record<string, unknown>)[k]),
          );
          return {
            select() {
              return {
                async single(): Promise<FakeResult<Record<string, unknown>>> {
                  if (conflict) {
                    return { data: null, error: { message: "duplicate key value", code: "23505" } };
                  }
                  const row = {
                    id: `generated-${String(nextId)}`,
                    created_at: "2026-01-01T00:00:00.000Z",
                    updated_at: "2026-01-01T00:00:00.000Z",
                    meta_campaign_id: null,
                    meta_ad_set_id: null,
                    error_message: null,
                    ...(values as Record<string, unknown>),
                  };
                  nextId += 1;
                  rows.push(row);
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        update(values: Partial<Row>) {
          const filters: Array<[string, unknown]> = [];
          // Real repository code sometimes awaits `.update(...).eq(...)` directly (no `.select()` —
          // `markCreated`/`markFailed`/`markPartialFailure`/`markSimulated`), and sometimes chains
          // `.select().maybeSingle()` (`reclaim`, for its compare-and-swap read-back). `builder`
          // supports both: it is itself `PromiseLike` (applies the update on await) AND exposes
          // `.select()`.
          const builder: PromiseLike<FakeResult<null>> & {
            eq: (column: string, value: unknown) => typeof builder;
            select: () => {
              maybeSingle: () => Promise<FakeResult<Record<string, unknown> | null>>;
            };
          } = {
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return builder;
            },
            select() {
              return {
                async maybeSingle(): Promise<FakeResult<Record<string, unknown> | null>> {
                  const found = rows.find((r) => matches(r, filters));
                  if (found === undefined) {
                    return { data: null, error: null };
                  }
                  Object.assign(found, values as Record<string, unknown>);
                  return { data: found, error: null };
                },
              };
            },
            then(onFulfilled, onRejected) {
              const found = rows.find((r) => matches(r, filters));
              if (found !== undefined) {
                Object.assign(found, values as Record<string, unknown>);
              }
              return Promise.resolve({ data: null, error: null } as FakeResult<null>).then(
                onFulfilled,
                onRejected,
              );
            },
          };
          return builder;
        },
      };
    },
    channel() {
      throw new Error("not implemented in fake");
    },
  } as unknown as SupabaseClientLike & {
    seed: (row: Record<string, unknown>) => void;
    rows: () => readonly Record<string, unknown>[];
  };
}

const KEY = { tenantId: "dss-motor", growthObjectiveId: "objective-1", listingId: "listing-1" };

describe("CampaignCreationRepository", () => {
  it("claim() inserts a new PENDING row when no row exists yet for this key", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CampaignCreationRepository(client);
    const claimed = await repo.claim({
      ...KEY,
      creationRequestId: "req-1",
      blueprintId: "bp-1",
    });
    expect(claimed?.status).toBe("PENDING");
    expect(claimed?.tenantId).toBe(KEY.tenantId);
  });

  it("claim() returns undefined (never throws) on a real unique-constraint conflict", async () => {
    const client = createFakeSupabaseClient();
    client.seed({
      id: "existing-1",
      tenant_id: KEY.tenantId,
      growth_objective_id: KEY.growthObjectiveId,
      listing_id: KEY.listingId,
      creation_request_id: "req-0",
      blueprint_id: "bp-0",
      status: "CREATED",
      meta_campaign_id: "campaign-existing",
      meta_ad_set_id: "adset-existing",
      error_message: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new CampaignCreationRepository(client);
    const claimed = await repo.claim({ ...KEY, creationRequestId: "req-1", blueprintId: "bp-1" });
    expect(claimed).toBeUndefined();
  });

  it("findByKey() returns the existing row honestly after a lost claim race", async () => {
    const client = createFakeSupabaseClient();
    client.seed({
      id: "existing-1",
      tenant_id: KEY.tenantId,
      growth_objective_id: KEY.growthObjectiveId,
      listing_id: KEY.listingId,
      creation_request_id: "req-0",
      blueprint_id: "bp-0",
      status: "CREATED",
      meta_campaign_id: "campaign-existing",
      meta_ad_set_id: "adset-existing",
      error_message: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new CampaignCreationRepository(client);
    const found = await repo.findByKey(KEY.tenantId, KEY.growthObjectiveId, KEY.listingId);
    expect(found?.metaCampaignId).toBe("campaign-existing");
  });

  it("reclaim() atomically flips a FAILED row back to PENDING and clears stale meta ids", async () => {
    const client = createFakeSupabaseClient();
    client.seed({
      id: "existing-1",
      tenant_id: KEY.tenantId,
      growth_objective_id: KEY.growthObjectiveId,
      listing_id: KEY.listingId,
      creation_request_id: "req-0",
      blueprint_id: "bp-0",
      status: "FAILED",
      meta_campaign_id: null,
      meta_ad_set_id: null,
      error_message: "previous boom",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new CampaignCreationRepository(client);
    const reclaimed = await repo.reclaim("existing-1", "FAILED", {
      creationRequestId: "req-2",
      blueprintId: "bp-2",
    });
    expect(reclaimed?.status).toBe("PENDING");
    expect(reclaimed?.creationRequestId).toBe("req-2");
    expect(reclaimed?.errorMessage).toBeUndefined();
  });

  it("reclaim() loses the race (returns undefined) when the row's status no longer matches", async () => {
    const client = createFakeSupabaseClient();
    client.seed({
      id: "existing-1",
      tenant_id: KEY.tenantId,
      growth_objective_id: KEY.growthObjectiveId,
      listing_id: KEY.listingId,
      creation_request_id: "req-0",
      blueprint_id: "bp-0",
      // Already reclaimed to PENDING by a concurrent request.
      status: "PENDING",
      meta_campaign_id: null,
      meta_ad_set_id: null,
      error_message: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new CampaignCreationRepository(client);
    const reclaimed = await repo.reclaim("existing-1", "FAILED", {
      creationRequestId: "req-2",
      blueprintId: "bp-2",
    });
    expect(reclaimed).toBeUndefined();
  });

  it("reclaim() refuses a non-reclaimable status (CREATED/PARTIAL_FAILURE/PENDING) defensively", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CampaignCreationRepository(client);
    await expect(
      repo.reclaim("existing-1", "CREATED", { creationRequestId: "req-2", blueprintId: "bp-2" }),
    ).rejects.toThrow(CampaignCreationRepositoryError);
  });

  it("markCreated() / markPartialFailure() / markFailed() / markSimulated() update the row honestly", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CampaignCreationRepository(client);
    const claimed = await repo.claim({ ...KEY, creationRequestId: "req-1", blueprintId: "bp-1" });
    const id = claimed?.id as string;

    await repo.markCreated(id, "campaign-1", "adset-1");
    let found = await repo.findByKey(KEY.tenantId, KEY.growthObjectiveId, KEY.listingId);
    expect(found?.status).toBe("CREATED");
    expect(found?.metaCampaignId).toBe("campaign-1");
    expect(found?.metaAdSetId).toBe("adset-1");

    await repo.markPartialFailure(id, "campaign-2", "adset boom");
    found = await repo.findByKey(KEY.tenantId, KEY.growthObjectiveId, KEY.listingId);
    expect(found?.status).toBe("PARTIAL_FAILURE");
    expect(found?.errorMessage).toBe("adset boom");

    await repo.markFailed(id, "campaign boom");
    found = await repo.findByKey(KEY.tenantId, KEY.growthObjectiveId, KEY.listingId);
    expect(found?.status).toBe("FAILED");

    await repo.markSimulated(id);
    found = await repo.findByKey(KEY.tenantId, KEY.growthObjectiveId, KEY.listingId);
    expect(found?.status).toBe("SIMULATED");
  });
});
