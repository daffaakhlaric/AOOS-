import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "overview_daily_snapshots";

/** Raw `overview_daily_snapshots` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/059_overview_daily_snapshots.sql`. */
export interface OverviewSnapshotRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly snapshot_date: string;
  readonly total_spend: number;
  readonly total_leads: number;
  readonly created_at: string;
}

/** camelCase shape `GET /api/v1/overview/timeseries` returns one point of, oldest-to-newest. */
export interface OverviewDailySnapshot {
  readonly date: string;
  readonly totalSpend: number;
  readonly totalLeads: number;
}

export class OverviewSnapshotRepositoryError extends Error {}

/**
 * Same real `.upsert()` situation `AdTenantIndexRepository`/`MetaSyncRepository` already document
 * on themselves: the shared `SupabaseClientLike` port (`@aos/lead-store`'s `SupabaseTypes.ts`)
 * declares only `select`/`insert`/`update` — no `upsert`. The REAL underlying client genuinely has
 * `.upsert(values, { onConflict })`, so a narrow, file-local cast is the same established, safe
 * pattern those two repositories already use for this exact real capability gap.
 */
interface UpsertableSupabaseClient {
  from(table: string): {
    upsert(
      values: ReadonlyArray<Record<string, unknown>>,
      options: { readonly onConflict: string },
    ): PromiseLike<{ readonly error: { readonly message: string } | null }>;
  };
}

/**
 * Supabase-backed persistence for `overview_daily_snapshots` (EYVRA SAMANTHA V2 + KAI V2 Phase 56 —
 * Command Center "Performance Overview" chart, `059_overview_daily_snapshots.sql`). One row per
 * `(tenantId, snapshot_date)`, written once daily by `OverviewSnapshotCronService.runDailySnapshotSweep`
 * and upserted idempotently on that real UNIQUE constraint — see that migration's own header for why
 * a re-run for the same UTC day overwrites rather than duplicates.
 */
export class OverviewSnapshotRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /** Idempotent upsert on `(tenant_id, snapshot_date)` — the caller's own cron sweep must be safe to run twice in one UTC day without double-counting; this is the one write path that guarantees it. */
  async upsert(
    tenantId: string,
    date: string,
    totalSpend: number,
    totalLeads: number,
  ): Promise<void> {
    const client = this.client as unknown as UpsertableSupabaseClient;
    const { error } = await client.from(TABLE).upsert(
      [
        {
          tenant_id: tenantId,
          snapshot_date: date,
          total_spend: totalSpend,
          total_leads: totalLeads,
        },
      ],
      { onConflict: "tenant_id,snapshot_date" },
    );
    if (error !== null) {
      throw new OverviewSnapshotRepositoryError(
        `OverviewSnapshotRepository.upsert failed: ${error.message}`,
      );
    }
  }

  /** Every real snapshot row for this tenant over the last `days` calendar days, ascending by date — the exact shape `GET /api/v1/overview/timeseries` returns as-is. An empty array is a real, honest result (never fabricated) for a tenant the cron hasn't swept yet. */
  async listRecent(tenantId: string, days: number): Promise<readonly OverviewDailySnapshot[]> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - Math.max(days - 1, 0));
    const sinceDateKey = since.toISOString().slice(0, 10);

    const { data, error } = await this.client
      .from<OverviewSnapshotRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("snapshot_date", sinceDateKey)
      .order("snapshot_date", { ascending: true });
    if (error !== null) {
      throw new OverviewSnapshotRepositoryError(
        `OverviewSnapshotRepository.listRecent failed: ${error.message}`,
      );
    }
    return (data ?? []).map((row) => ({
      date: row.snapshot_date,
      totalSpend: row.total_spend,
      totalLeads: row.total_leads,
    }));
  }
}
