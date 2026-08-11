import type { Result } from "@aos/common";

import type { ScoringEvent } from "../domain/entities/ScoringEvent.js";
import type { SupabaseError } from "../domain/errors/SupabaseError.js";
import type { LeadId } from "../domain/value-objects/LeadId.js";

/** Repository contract for `scoring_events`. */
export interface IScoringRepository {
  insert(event: ScoringEvent): Promise<Result<ScoringEvent, SupabaseError>>;
  findByLeadId(leadId: LeadId): Promise<Result<readonly ScoringEvent[], SupabaseError>>;
}
