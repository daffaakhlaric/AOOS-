import { MetaApiClient } from "@aos/meta-ads-connector";
import { ConflictException, HttpException, Injectable, NotFoundException } from "@nestjs/common";

import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";

import { ActionExecutor } from "./action-executor.service.js";
import { ActionPolicyContext } from "./action-policy-context.js";
import { ActionQueryService } from "./action-query.service.js";
import { statusTarget } from "./action-status.contract.js";
import { ActionRepository, assertStepPlan, commandHash } from "./action.repository.js";
import type { ActionCommand } from "./action.types.js";

@Injectable()
export class ActionRuntimeService {
  constructor(
    private readonly repository: ActionRepository,
    private readonly context: ActionPolicyContext,
    private readonly queries: ActionQueryService,
  ) {}

  /** Read-only preview. A successful preview is not approval and never bypasses execute rechecks. */
  async preflight(identity: TrustedTenantContext, id: string) {
    const row = await this.repository.find(identity.tenantId, id);
    if (
      !row ||
      row.tenant_id !== identity.tenantId ||
      row.command.workspaceId !== identity.workspaceId
    )
      throw new NotFoundException("Action not found");
    const checkedAt = new Date().toISOString();
    try {
      if (!["AWAITING_APPROVAL", "APPROVED"].includes(row.state))
        throw new ConflictException("ACTION_NOT_EXECUTABLE");
      if (commandHash(row.command) !== row.command_hash)
        throw new ConflictException("ACTION_REVISION_MISMATCH");
      assertStepPlan(row.command, await this.repository.steps(identity.tenantId, id));
      const ctx = await this.context.resolve(identity, row.command);
      const reader = new MetaApiClient({ timeoutMs: 15000 });
      const before = await reader.verifyObjectState(
        row.command.entityId,
        row.command.adAccountId,
        { status: String(row.command.currentStateSnapshot.status) },
        ctx.accessToken,
      );
      if (before.status !== "VERIFIED") throw new ConflictException("STALE_OR_UNVERIFIED_ACTION");
      return { ready: true, blocked: [] as string[], checkedAt, commandHash: row.command_hash };
    } catch (error) {
      // Never expose provider errors, credential values, or database details.
      const code =
        error instanceof HttpException && /^[A-Z][A-Z0-9_]+$/.test(error.message)
          ? error.message
          : "PREFLIGHT_UNAVAILABLE";
      return { ready: false, blocked: [code], checkedAt, commandHash: row.command_hash };
    }
  }

  async execute(identity: TrustedTenantContext, id: string) {
    const reader = new MetaApiClient({ timeoutMs: 15000 });
    const revalidate = async (command: ActionCommand) => {
      const ctx = await this.context.resolve(identity, command);
      const before = await reader.verifyObjectState(
        command.entityId,
        command.adAccountId,
        { status: String(command.currentStateSnapshot.status) },
        ctx.accessToken,
      );
      const target =
        before.status === "VERIFIED"
          ? null
          : await reader.verifyObjectState(
              command.entityId,
              command.adAccountId,
              { status: statusTarget(command) },
              ctx.accessToken,
            );
      if (before.status !== "VERIFIED" && target?.status !== "VERIFIED")
        throw new ConflictException("STALE_OR_UNVERIFIED_ACTION");
    };
    const verify = async (command: ActionCommand) => {
      const ctx = await this.context.resolve(identity, command);
      const checked = await reader.verifyObjectState(
        command.entityId,
        command.adAccountId,
        { status: statusTarget(command) },
        ctx.accessToken,
      );
      return {
        matches: checked.status === "VERIFIED",
        evidence: { status: checked.status, observed: checked.observed ?? {} },
      };
    };
    const executor = new ActionExecutor(this.repository, {
      revalidate,
      submit: async (command, step) => {
        const ctx = await this.context.resolve(identity, command);
        const already = await reader.verifyObjectState(
          command.entityId,
          command.adAccountId,
          { status: statusTarget(command) },
          ctx.accessToken,
        );
        if (already.status === "VERIFIED")
          return {
            id: command.entityId,
            receipt: { result: "ALREADY_IN_TARGET_STATE", mutated: false },
          };
        await revalidate(command);
        let persisted: Record<string, unknown> | undefined;
        const client = new MetaApiClient({
          timeoutMs: 15000,
          authorizeWrite: async (operation) => {
            await revalidate(command);
            return new RegExp(`^/v[0-9]+\\.[0-9]+/${command.entityId}$`).test(operation);
          },
          persistReceipt: async (receipt) => {
            persisted = { ...receipt };
            await this.repository.recordReceipt(step, persisted, command.entityId);
          },
        });
        const result =
          command.actionType === "PAUSE_CAMPAIGN"
            ? await client.pauseCampaign(command.entityId, ctx.accessToken)
            : await client.activateCampaign(command.entityId, ctx.accessToken);
        if (!result.ok || !persisted) throw new Error("PROVIDER_RESULT_REQUIRES_RECONCILIATION");
        return { id: command.entityId, receipt: persisted };
      },
      verify: async (command) => verify(command),
      verifyHierarchy: async (command) => (await verify(command)).matches,
    });
    await executor.execute(identity.tenantId, id);
    return this.queries.detail(identity.tenantId, id);
  }
}
