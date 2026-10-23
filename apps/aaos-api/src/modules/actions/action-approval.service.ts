import { MetaApiClient } from "@aos/meta-ads-connector";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";
import type { GROWTH_ACTIONS } from "../automation-policy/domain/growth-policy.js";
import { GrowthPolicyService } from "../automation-policy/growth-policy.service.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";

import { ActionActivityService } from "./action-activity.service.js";
import { ActionEvidenceService } from "./action-evidence.service.js";
import { actionSummary } from "./action-query.service.js";
import { ActionRepository, commandHash } from "./action.repository.js";
import type { ActionCommand } from "./action.types.js";

const POLICY_ACTION: Partial<Record<ActionCommand["actionType"], (typeof GROWTH_ACTIONS)[number]>> =
  {
    PAUSE_CAMPAIGN: "PAUSE_CAMPAIGN",
    PAUSE_ADSET: "PAUSE_CAMPAIGN",
    PAUSE_AD: "PAUSE_CREATIVE",
    RESUME_CAMPAIGN: "RESUME_CAMPAIGN",
    RESUME_ADSET: "RESUME_CAMPAIGN",
    RESUME_AD: "RESUME_CAMPAIGN",
    UPDATE_BUDGET: "SCALE",
  };

@Injectable()
export class ActionApprovalService {
  private readonly reader = new MetaApiClient({ timeoutMs: 15000 });
  constructor(
    private readonly repository: ActionRepository,
    private readonly policy: GrowthPolicyService,
    @Inject(META_ADS_CONNECTOR_REGISTRY) private readonly registry: MetaAdsConnectorRegistry,
    private readonly evidence: ActionEvidenceService,
    private readonly activity: ActionActivityService,
  ) {}

  /** Records approval only. It does not claim execution or elevate any Phase 3 capability. */
  async approve(identity: TrustedTenantContext, id: string, expectedHash: string) {
    if (!identity.userId || !identity.permissions.includes("campaign:write"))
      throw new ForbiddenException("ACTION_APPROVAL_FORBIDDEN");
    const row = await this.repository.find(identity.tenantId, id);
    if (
      !row ||
      row.tenant_id !== identity.tenantId ||
      row.command.tenantId !== identity.tenantId ||
      row.command.workspaceId !== identity.workspaceId
    )
      throw new NotFoundException("Action not found");
    if (row.state !== "AWAITING_APPROVAL")
      throw new ConflictException("ACTION_NOT_AWAITING_APPROVAL");
    const command = row.command;
    if (row.command_hash !== expectedHash || commandHash(command) !== expectedHash)
      throw new ConflictException("ACTION_REVISION_MISMATCH");
    if (!command.evidenceSnapshotId) throw new ConflictException("EVIDENCE_REQUIRED");
    const policyAction = POLICY_ACTION[command.actionType];
    if (!policyAction) throw new ConflictException("ACTION_APPROVAL_NOT_SUPPORTED");
    const checkContext = async () => {
      await this.evidence.verify(command);
      const current = await this.policy.current(identity.tenantId);
      if (current.version !== command.policyVersion)
        throw new ConflictException("REAPPROVAL_REQUIRED");
      if (
        current.policy.safetyPolicy.killSwitch ||
        current.policy.safetyPolicy.permissions[policyAction] === "DISABLED"
      )
        throw new ConflictException("ACTION_BLOCKED_BY_POLICY");
      const resolved = await this.registry.resolve(identity.tenantId);
      if (!resolved.ok) throw new ConflictException("INTEGRATION_UNAVAILABLE");
      const connection = resolved.value;
      if (
        connection.tenantId !== identity.tenantId ||
        connection.integrationId !== command.integrationId ||
        connection.credentialVersion !== command.credentialVersion ||
        connection.adAccountIds.length !== 1 ||
        connection.adAccountIds[0] !== command.adAccountId
      )
        throw new ConflictException("INTEGRATION_CHANGED");
      return connection;
    };
    const connection = await checkContext();
    const expected: Record<string, string> = {};
    const keys = command.actionType === "UPDATE_BUDGET" ? ["daily_budget", "status"] : ["status"];
    for (const key of keys) {
      const value = command.currentStateSnapshot[key];
      if (typeof value !== "string" || !value.length)
        throw new ConflictException("BEFORE_STATE_REQUIRED");
      expected[key] = value;
    }
    const verified = await this.reader.verifyObjectState(
      command.entityId,
      command.adAccountId,
      expected,
      connection.accessToken,
    );
    if (verified.status !== "VERIFIED") throw new ConflictException("STALE_OR_UNVERIFIED_ACTION");
    await checkContext();
    if (!(await this.repository.approve(identity.tenantId, id, expectedHash, identity.userId)))
      throw new ConflictException("ACTION_ALREADY_DECIDED");
    const updated = await this.repository.find(identity.tenantId, id);
    if (!updated) throw new ConflictException("ACTION_READ_FAILED");
    await this.activity.record(updated, identity.userId, "APPROVAL");
    return {
      ...actionSummary(updated),
      executionReady: false,
      executionBlock: "EXECUTION_PREFLIGHT_REQUIRED",
    };
  }
}
