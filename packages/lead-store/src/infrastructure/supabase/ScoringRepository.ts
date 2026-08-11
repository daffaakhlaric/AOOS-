import { err, ok, type Result } from "@aos/common";

import type { IScoringRepository } from "../../contracts/IScoringRepository.js";
import { ScoringEvent } from "../../domain/entities/ScoringEvent.js";
import { SupabaseError } from "../../domain/errors/SupabaseError.js";
import type { LeadId } from "../../domain/value-objects/LeadId.js";
import { LeadId as LeadIdVo } from "../../domain/value-objects/LeadId.js";
import { parseScoreReason } from "../../domain/value-objects/ScoreReason.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

const TABLE = "scoring_events";

/** Exact shape of the `scoring_events` table (spec `001_initial_schema.sql`). */
export interface ScoringEventRow {
  readonly id: string;
  readonly lead_id: string;
  readonly score_before: number;
  readonly score_after: number;
  readonly delta: number;
  readonly reason: string;
  readonly triggered_by: string | null;
  readonly created_at: string;
}

/** Supabase implementation of `IScoringRepository`. */
export class ScoringRepository implements IScoringRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(event: ScoringEvent): Promise<Result<ScoringEvent, SupabaseError>> {
    const { data, error } = await this.client
      .from<ScoringEventRow>(TABLE)
      .insert(toRow(event))
      .select("*")
      .single();
    if (error !== null) {
      return err(new SupabaseError(`ScoringRepository.insert failed: ${error.message}`));
    }
    if (data === null) {
      return err(new SupabaseError("ScoringRepository.insert failed: no row returned"));
    }
    return mapRow(data);
  }

  async findByLeadId(leadId: LeadId): Promise<Result<readonly ScoringEvent[], SupabaseError>> {
    const { data, error } = await this.client
      .from<ScoringEventRow>(TABLE)
      .select("*")
      .eq("lead_id", leadId.toString())
      .order("created_at", { ascending: true });
    if (error !== null) {
      return err(new SupabaseError(`ScoringRepository.findByLeadId failed: ${error.message}`));
    }
    const events: ScoringEvent[] = [];
    for (const row of data ?? []) {
      const mapped = mapRow(row);
      if (!mapped.ok) {
        return mapped;
      }
      events.push(mapped.value);
    }
    return ok(events);
  }
}

function toRow(event: ScoringEvent): ScoringEventRow {
  return {
    id: event.id,
    lead_id: event.leadId.toString(),
    score_before: event.scoreBefore,
    score_after: event.scoreAfter,
    delta: event.delta,
    reason: event.reason,
    triggered_by: event.triggeredBy ?? null,
    created_at: event.createdAt.toISOString(),
  };
}

function mapRow(row: ScoringEventRow): Result<ScoringEvent, SupabaseError> {
  const leadIdResult = LeadIdVo.create(row.lead_id);
  if (!leadIdResult.ok) {
    return err(
      new SupabaseError(`ScoringRepository: row mapping failed: ${leadIdResult.error.message}`),
    );
  }
  const reasonResult = parseScoreReason(row.reason);
  if (!reasonResult.ok) {
    return err(
      new SupabaseError(`ScoringRepository: row mapping failed: ${reasonResult.error.message}`),
    );
  }
  const eventResult = ScoringEvent.create({
    id: row.id,
    leadId: leadIdResult.value,
    scoreBefore: row.score_before,
    scoreAfter: row.score_after,
    delta: row.delta,
    reason: reasonResult.value,
    triggeredBy: row.triggered_by ?? undefined,
    createdAt: new Date(row.created_at),
  });
  if (!eventResult.ok) {
    return err(
      new SupabaseError(`ScoringRepository: row mapping failed: ${eventResult.error.message}`),
    );
  }
  return ok(eventResult.value);
}
