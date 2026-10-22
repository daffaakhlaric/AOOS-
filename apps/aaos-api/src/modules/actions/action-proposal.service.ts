import type { SupabaseClientLike } from "@aos/lead-store";
import { MetaApiClient } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import { META_ADS_CONNECTOR_REGISTRY, SUPABASE_CLIENT } from "../../di-tokens.js";
import type { CampaignAssessmentRow } from "../campaign-health/infrastructure/campaign-assessment.repository.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import type { PendingActionRow } from "../pending-actions/infrastructure/pending-action.repository.js";

import { routeRecommendation } from "./action-registry.js";
import { ActionRepository, assertStepPlan } from "./action.repository.js";

/** Read-only Meta preparation; never approves or submits a provider mutation. */
@Injectable()
export class ActionProposalService {
  private readonly reader = new MetaApiClient({ timeoutMs: 15000 });
  constructor(
    private readonly repository: ActionRepository,
    @Inject(SUPABASE_CLIENT) private readonly db: SupabaseClientLike,
    @Inject(META_ADS_CONNECTOR_REGISTRY) private readonly registry: MetaAdsConnectorRegistry,
  ) {}

  async fromRecommendation(row: PendingActionRow): Promise<void> {
    if (row.status !== "PENDING" || row.action_type !== "REVIEW_SAMANTHA_RECOMMENDATION") return;
    const route = routeRecommendation(String(row.payload["decision"]), "CAMPAIGN");
    if (route.kind !== "META_ACTION" || route.actionType !== "PAUSE_CAMPAIGN") return;
    // Repeated scheduler ticks use the existing queue ID; never replace an approved command.
    const existing = await this.repository.find(row.tenant_id, row.id);
    if (existing) {
      assertStepPlan(existing.command, await this.repository.steps(row.tenant_id, row.id));
      return;
    }
    const campaignId = row.payload["campaignId"];
    const evidenceId = row.payload["assessmentId"];
    const version = row.payload["policyVersion"];
    if (
      typeof campaignId !== "string" ||
      !/^\d+$/.test(campaignId) ||
      typeof evidenceId !== "string" ||
      typeof version !== "number" ||
      !Number.isInteger(version) ||
      version < 1
    )
      throw new Error("PROPOSAL_EVIDENCE_REQUIRED");
    const evidence = await this.db
      .from<CampaignAssessmentRow>("samantha_campaign_assessments")
      .select("*")
      .eq("tenant_id", row.tenant_id)
      .eq("id", evidenceId)
      .eq("meta_campaign_id", campaignId)
      .maybeSingle();
    if (evidence.error || !evidence.data || evidence.data.decision.decision !== "PAUSE")
      throw new Error("PROPOSAL_EVIDENCE_MISMATCH");
    const resolved = await this.registry.resolve(row.tenant_id);
    if (!resolved.ok) throw new Error("INTEGRATION_UNAVAILABLE");
    const ctx = resolved.value;
    if (
      ctx.tenantId !== row.tenant_id ||
      !ctx.integrationId ||
      !ctx.credentialVersion ||
      ctx.adAccountIds.length !== 1
    )
      throw new Error("INTEGRATION_UNVERIFIED");
    const account = ctx.adAccountIds[0]!;
    const before = await this.reader.verifyObjectState(
      campaignId,
      account,
      { status: "ACTIVE" },
      ctx.accessToken,
    );
    if (before.status !== "VERIFIED") throw new Error("PROPOSAL_CURRENT_STATE_UNVERIFIED");
    try {
      await this.repository.create(
        {
          actionId: row.id,
          revision: 1,
          tenantId: row.tenant_id,
          workspaceId: row.tenant_id,
          integrationId: ctx.integrationId,
          credentialVersion: ctx.credentialVersion,
          adAccountId: account,
          actor: { type: "SAMANTHA" },
          actionType: "PAUSE_CAMPAIGN",
          entityType: "CAMPAIGN",
          entityId: campaignId,
          targetState: { status: "PAUSED" },
          currentStateSnapshot: { status: "ACTIVE" },
          policyVersion: version,
          evidenceSnapshotId: evidenceId,
          reason: evidence.data.decision.reason,
          correlationId:
            typeof row.payload["correlationId"] === "string"
              ? row.payload["correlationId"]
              : row.id,
          createdAt: row.created_at,
          steps: [{ key: "pause-campaign", intent: { status: "PAUSED" } }],
        },
        row.id,
      );
    } catch (error) {
      // A competing instance may have inserted the same immutable proposal. Incomplete plans
      // are still rejected by approval's exact step-plan validation; never repair a claimed plan.
      const winner = await this.repository.find(row.tenant_id, row.id);
      if (!winner) throw error;
      assertStepPlan(winner.command, await this.repository.steps(row.tenant_id, row.id));
    }
  }
}
