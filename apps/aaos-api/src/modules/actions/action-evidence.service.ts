import type { SupabaseClientLike } from "@aos/lead-store";
import { ConflictException, Inject, Injectable } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import type { CampaignAssessmentRow } from "../campaign-health/infrastructure/campaign-assessment.repository.js";

import type { ActionCommand } from "./action.types.js";

/** Assessment freshness ceiling for approval; never a claim that tracking/learning is healthy. */
export const ACTION_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export function validateActionEvidence(
  command: ActionCommand,
  row: CampaignAssessmentRow | null,
  now = Date.now(),
) {
  if (
    !row ||
    row.id !== command.evidenceSnapshotId ||
    row.tenant_id !== command.tenantId ||
    row.meta_campaign_id !== command.entityId ||
    command.entityType !== "CAMPAIGN"
  )
    throw new ConflictException("ACTION_EVIDENCE_MISMATCH");
  if (
    command.actionType !== "PAUSE_CAMPAIGN" ||
    row.decision?.decision !== "PAUSE" ||
    !row.decision.reason ||
    row.decision.reason !== command.reason
  )
    throw new ConflictException("ACTION_EVIDENCE_CHANGED");
  const age = now - Date.parse(row.assessed_at);
  if (!Number.isFinite(age) || age < 0 || age > ACTION_EVIDENCE_MAX_AGE_MS)
    throw new ConflictException("ACTION_EVIDENCE_EXPIRED");
}

@Injectable()
export class ActionEvidenceService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly db: SupabaseClientLike) {}
  async verify(command: ActionCommand) {
    if (command.actor.type === "HUMAN") return;
    if (command.actor.type !== "SAMANTHA")
      throw new ConflictException("ACTION_EVIDENCE_UNSUPPORTED");
    const result = await this.db
      .from<CampaignAssessmentRow>("samantha_campaign_assessments")
      .select("*")
      .eq("tenant_id", command.tenantId)
      .eq("meta_campaign_id", command.entityId)
      .eq("id", command.evidenceSnapshotId)
      .maybeSingle();
    if (result.error) throw new ConflictException("ACTION_EVIDENCE_UNAVAILABLE");
    validateActionEvidence(command, result.data);
    // A more recent assessment invalidates the older recommendation even if its text is similar.
    const latest = await this.db
      .from<CampaignAssessmentRow>("samantha_campaign_assessments")
      .select("id")
      .eq("tenant_id", command.tenantId)
      .eq("meta_campaign_id", command.entityId)
      .order("assessed_at", { ascending: false })
      .limit(1);
    if (latest.error || latest.data?.length !== 1)
      throw new ConflictException("ACTION_EVIDENCE_UNAVAILABLE");
    if (latest.data[0]!.id !== command.evidenceSnapshotId)
      throw new ConflictException("ACTION_EVIDENCE_SUPERSEDED");
    return result.data!;
  }
}
