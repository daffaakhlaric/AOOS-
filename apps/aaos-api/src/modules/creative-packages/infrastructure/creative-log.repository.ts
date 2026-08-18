import { randomUUID } from "node:crypto";

import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  AppendCreativeLogInput,
  CreativeLogAgent,
  CreativeLogEntry,
  CreativeLogEventType,
  CreativeLogJson,
  CreativeLogTarget,
  ListCreativeLogsFilter,
} from "../domain/creative-log.js";

const TABLE = "creative_logs";

/**
 * Raw `creative_logs` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/004_creative_logs.sql`. Any future column MUST be added in both files in
 * the same change.
 */
export interface CreativeLogRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly package_id: string | null;
  readonly from_agent: string;
  readonly to_agent: string | null;
  readonly event_type: string;
  readonly message: string;
  readonly brief: CreativeLogJson | null;
  readonly result: CreativeLogJson | null;
  readonly error: string | null;
  readonly metadata: CreativeLogJson | null;
  readonly ad_id: string | null;
  readonly stable_id: string | null;
  readonly created_at: string;
}

export class CreativeLogRepositoryError extends Error {}

function toDomain(row: CreativeLogRow): CreativeLogEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ...(row.package_id !== null ? { packageId: row.package_id } : {}),
    fromAgent: row.from_agent as CreativeLogAgent,
    ...(row.to_agent !== null ? { toAgent: row.to_agent as CreativeLogTarget } : {}),
    eventType: row.event_type as CreativeLogEventType,
    message: row.message,
    ...(row.brief !== null ? { brief: row.brief } : {}),
    ...(row.result !== null ? { result: row.result } : {}),
    ...(row.error !== null ? { error: row.error } : {}),
    ...(row.metadata !== null ? { metadata: row.metadata } : {}),
    ...(row.ad_id !== null ? { adId: row.ad_id } : {}),
    ...(row.stable_id !== null ? { stableId: row.stable_id } : {}),
    createdAt: row.created_at,
  };
}

/**
 * Append-only Supabase persistence for `creative_logs` (AAOS-CREATIVE-REVIEW). Deliberately exposes
 * NO update/delete: this is an audit trail, and a row that was written described something that
 * really happened, so nothing may rewrite it after the fact.
 */
export class CreativeLogRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async append(input: AppendCreativeLogInput, createdAt: string): Promise<CreativeLogEntry> {
    const row: CreativeLogRow = {
      id: randomUUID(),
      tenant_id: input.tenantId,
      package_id: input.packageId ?? null,
      from_agent: input.fromAgent,
      to_agent: input.toAgent ?? null,
      event_type: input.eventType,
      message: input.message,
      brief: input.brief ?? null,
      result: input.result ?? null,
      error: input.error ?? null,
      metadata: input.metadata ?? null,
      ad_id: input.adId ?? null,
      stable_id: input.stableId ?? null,
      created_at: createdAt,
    };
    const { error } = await this.client.from<CreativeLogRow>(TABLE).insert(row);
    if (error !== null) {
      throw new CreativeLogRepositoryError(`CreativeLogRepository.append failed: ${error.message}`);
    }
    return toDomain(row);
  }

  /** Newest first — the log tab renders chronologically descending. */
  async list(filter: ListCreativeLogsFilter): Promise<readonly CreativeLogEntry[]> {
    let query = this.client
      .from<CreativeLogRow>(TABLE)
      .select("*")
      .eq("tenant_id", filter.tenantId);
    if (filter.packageId !== undefined) {
      query = query.eq("package_id", filter.packageId);
    }
    if (filter.eventType !== undefined) {
      query = query.eq("event_type", filter.eventType);
    }
    if (filter.since !== undefined) {
      query = query.gte("created_at", filter.since);
    }
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(filter.limit);
    if (error !== null) {
      throw new CreativeLogRepositoryError(`CreativeLogRepository.list failed: ${error.message}`);
    }
    return (data ?? []).map(toDomain);
  }
}
