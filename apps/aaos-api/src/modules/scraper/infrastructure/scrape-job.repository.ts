import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  ScrapeJobKind,
  ScrapeJobLogEntry,
  ScrapeJobLogLevel,
  ScrapeJobResult,
  ScrapeJobStatus,
  StoredScrapeJob,
} from "../domain/scrape-job.js";

const TABLE = "scrape_jobs";
const LOG_TABLE = "scrape_job_logs";

/** Raw `scrape_jobs` row shape (snake_case) — see `supabase/migrations/002_scrape_jobs.sql`. */
interface ScrapeJobRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly kind: string;
  readonly status: string;
  readonly unit_url: string | null;
  readonly branch: string | null;
  readonly progress_current: number;
  readonly progress_total: number | null;
  readonly result: ScrapeJobResult | null;
  readonly error_message: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ScrapeJobLogRow {
  readonly job_id: string;
  readonly level: string;
  readonly message: string;
  readonly created_at: string;
}

export class ScrapeJobRepositoryError extends Error {}

function toDomain(row: ScrapeJobRow): StoredScrapeJob {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind as ScrapeJobKind,
    status: row.status as ScrapeJobStatus,
    unitUrl: row.unit_url ?? undefined,
    branch: row.branch ?? undefined,
    progressCurrent: row.progress_current,
    progressTotal: row.progress_total ?? undefined,
    result: row.result ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateScrapeJobInput {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: ScrapeJobKind;
  readonly unitUrl?: string;
  readonly branch?: string;
}

/**
 * Supabase-backed persistence for `scrape_jobs`/`scrape_job_logs` (AAOS-SCRAPER-ASSET-LIBRARY),
 * built on the same hand-rolled `SupabaseClientLike` port `@aos/lead-store`'s own repositories use —
 * no direct dependency on `@supabase/supabase-js`'s real generic-heavy client type. Shares the SAME
 * Supabase client `app.module.ts` already builds for `@aos/lead-store` (`SUPABASE_CLIENT` DI token),
 * not a second connection.
 *
 * Mirrors `modules/simulation/infrastructure/simulation.repository.ts` method-for-method
 * (`create`/`findById`/`list`/`complete`/`fail`/`appendLog`/`listLogs`), which is the pattern this
 * module was asked to follow.
 */
export class ScrapeJobRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: CreateScrapeJobInput): Promise<StoredScrapeJob> {
    const { data, error } = await this.client
      .from<ScrapeJobRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        kind: input.kind,
        status: "RUNNING",
        unit_url: input.unitUrl ?? null,
        branch: input.branch ?? null,
        progress_current: 0,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new ScrapeJobRepositoryError(
        `ScrapeJobRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async findById(id: string): Promise<StoredScrapeJob | undefined> {
    const { data, error } = await this.client
      .from<ScrapeJobRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new ScrapeJobRepositoryError(`ScrapeJobRepository.findById failed: ${error.message}`);
    }
    return data === null ? undefined : toDomain(data);
  }

  async list(limit = 20): Promise<readonly StoredScrapeJob[]> {
    const { data, error } = await this.client
      .from<ScrapeJobRow>(TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error !== null) {
      throw new ScrapeJobRepositoryError(`ScrapeJobRepository.list failed: ${error.message}`);
    }
    return (data ?? []).map(toDomain);
  }

  /** Advances the real progress counters mid-run so polling/SSE reflects actual work done. */
  async updateProgress(id: string, current: number, total?: number): Promise<void> {
    const { error } = await this.client
      .from<ScrapeJobRow>(TABLE)
      .update({
        progress_current: current,
        ...(total !== undefined ? { progress_total: total } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error !== null) {
      throw new ScrapeJobRepositoryError(
        `ScrapeJobRepository.updateProgress failed: ${error.message}`,
      );
    }
  }

  async complete(id: string, result: ScrapeJobResult): Promise<void> {
    const { error } = await this.client
      .from<ScrapeJobRow>(TABLE)
      .update({ status: "DONE", result, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error !== null) {
      throw new ScrapeJobRepositoryError(`ScrapeJobRepository.complete failed: ${error.message}`);
    }
  }

  async fail(id: string, errorMessage: string): Promise<void> {
    const { error } = await this.client
      .from<ScrapeJobRow>(TABLE)
      .update({
        status: "ERROR",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error !== null) {
      throw new ScrapeJobRepositoryError(`ScrapeJobRepository.fail failed: ${error.message}`);
    }
  }

  async appendLog(id: string, entry: ScrapeJobLogEntry): Promise<void> {
    const { error } = await this.client.from<ScrapeJobLogRow>(LOG_TABLE).insert({
      job_id: id,
      level: entry.level,
      message: entry.message,
      created_at: entry.createdAt,
    });
    if (error !== null) {
      throw new ScrapeJobRepositoryError(`ScrapeJobRepository.appendLog failed: ${error.message}`);
    }
  }

  async listLogs(id: string): Promise<readonly ScrapeJobLogEntry[]> {
    const { data, error } = await this.client
      .from<ScrapeJobLogRow>(LOG_TABLE)
      .select("*")
      .eq("job_id", id)
      .order("created_at", { ascending: true });
    if (error !== null) {
      throw new ScrapeJobRepositoryError(`ScrapeJobRepository.listLogs failed: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
      level: row.level as ScrapeJobLogLevel,
      message: row.message,
      createdAt: row.created_at,
    }));
  }
}
