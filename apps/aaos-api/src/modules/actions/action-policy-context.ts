import type { SupabaseClientLike } from "@aos/lead-store";
import { ConflictException, ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { META_ADS_CONNECTOR_REGISTRY, SUPABASE_CLIENT } from "../../di-tokens.js";
import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";
import {
  evaluateCampaignStatusPolicy,
  evaluateApprovedPausePolicy,
} from "../automation-policy/domain/policy-engine.js";
import { GrowthPolicyService } from "../automation-policy/growth-policy.service.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import type { MetricSnapshotDto } from "../metric-snapshot/dto/metric-snapshot.dto.js";

import { ActionEvidenceService } from "./action-evidence.service.js";
import { ActionLearningService } from "./action-learning.service.js";
import { statusTarget } from "./action-status.contract.js";
import type { ActionCommand } from "./action.types.js";

@Injectable()
export class ActionPolicyContext {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: SupabaseClientLike,
    private readonly policies: GrowthPolicyService,
    @Inject(META_ADS_CONNECTOR_REGISTRY) private readonly registry: MetaAdsConnectorRegistry,
    private readonly evidence: ActionEvidenceService,
    private readonly learning: ActionLearningService,
  ) {}

  /** Reconciliation reads provider state; it must remain available when writes are disabled. */
  async resolveReconciliation(identity: TrustedTenantContext, command: ActionCommand) {
    statusTarget(command);
    if (identity.tenantId !== command.tenantId || identity.workspaceId !== command.workspaceId)
      throw new ForbiddenException("ACTION_TENANT_MISMATCH");
    const member = await this.db
      .from<{ role: string }>("tenant_memberships")
      .select("role")
      .eq("tenant_id", identity.tenantId)
      .eq("user_id", identity.userId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (
      member.error ||
      !member.data ||
      !["OWNER", "ADMIN", "MEDIA_BUYER"].includes(member.data.role)
    )
      throw new ForbiddenException("ACTION_EXECUTION_FORBIDDEN");
    const result = await this.registry.resolve(identity.tenantId);
    if (!result.ok) throw new ConflictException("INTEGRATION_UNAVAILABLE");
    const ctx = result.value;
    if (
      ctx.tenantId !== command.tenantId ||
      ctx.integrationId !== command.integrationId ||
      ctx.credentialVersion !== command.credentialVersion ||
      ctx.adAccountIds.length !== 1 ||
      ctx.adAccountIds[0] !== command.adAccountId
    )
      throw new ConflictException("INTEGRATION_CHANGED");
    return ctx;
  }

  async resolve(identity: TrustedTenantContext, command: ActionCommand) {
    statusTarget(command);
    if (identity.tenantId !== command.tenantId || identity.workspaceId !== command.workspaceId)
      throw new ForbiddenException("ACTION_TENANT_MISMATCH");
    if (process.env["META_REAL_WRITES_ENABLED"] !== "true")
      throw new ConflictException("META_WRITE_DISABLED");
    const membership = await this.db
      .from<{ role: string; status: string }>("tenant_memberships")
      .select("role,status")
      .eq("tenant_id", identity.tenantId)
      .eq("user_id", identity.userId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (
      membership.error ||
      !membership.data ||
      !["OWNER", "ADMIN", "MEDIA_BUYER"].includes(membership.data.role)
    )
      throw new ForbiddenException("ACTION_EXECUTION_FORBIDDEN");
    const current = await this.policies.current(identity.tenantId);
    const blocked = evaluateCampaignStatusPolicy(
      current.policy,
      command.actionType,
      command.policyVersion,
      current.version,
    );
    if (blocked.length) throw new ConflictException(blocked[0]);
    const assessment = await this.evidence.verify(command);
    const resolved = await this.registry.resolve(identity.tenantId);
    if (!resolved.ok) throw new ConflictException("INTEGRATION_UNAVAILABLE");
    const ctx = resolved.value;
    if (
      ctx.tenantId !== command.tenantId ||
      ctx.integrationId !== command.integrationId ||
      ctx.credentialVersion !== command.credentialVersion ||
      ctx.adAccountIds.length !== 1 ||
      ctx.adAccountIds[0] !== command.adAccountId
    )
      throw new ConflictException("INTEGRATION_CHANGED");
    const tenant = await this.db
      .from<{
        meta_capabilities: {
          credentialVersion?: number;
          checkedAt?: string;
          capabilities?: Record<string, { state?: string }>;
        };
        meta_execution_tier: string;
      }>("tenants")
      .select("meta_capabilities,meta_execution_tier")
      .eq("tenant_id", command.tenantId)
      .maybeSingle();
    const caps = tenant.data?.meta_capabilities;
    const age = Date.now() - Date.parse(caps?.checkedAt ?? "");
    if (
      tenant.error ||
      !tenant.data ||
      !["COPILOT_READY", "AUTONOMOUS_ELIGIBLE"].includes(tenant.data.meta_execution_tier) ||
      caps?.credentialVersion !== command.credentialVersion ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > 15 * 60 * 1000 ||
      caps.capabilities?.[command.actionType]?.state !== "AVAILABLE"
    )
      throw new ConflictException("META_CAPABILITY_UNVERIFIED");
    if (command.actor.type !== "HUMAN") {
      const snapshot = assessment?.health.runtimeEvidence?.["current"] as
        Partial<MetricSnapshotDto> | undefined;
      const pauseBlocks = evaluateApprovedPausePolicy(current.policy, {
        confidence: assessment?.decision.confidence,
        diagnosis: assessment?.decision.primaryDiagnosis,
        daysCovered: snapshot?.daysCovered,
        dataLevel: snapshot?.dataSufficiency?.level,
        spend: snapshot?.spend,
        leads: snapshot?.leads,
      });
      if (pauseBlocks.length) throw new ConflictException(pauseBlocks[0]);
      await this.learning.verify(command, ctx.accessToken);
    }
    return ctx;
  }
}
