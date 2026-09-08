import { randomUUID } from "node:crypto";

import { ConflictError, NotFoundError } from "@aos/errors";
import { Injectable, Logger, Optional } from "@nestjs/common";

import { AuditLogService } from "../audit-log/audit-log.service.js";
import { CampaignsService } from "../campaigns/campaigns.service.js";
import type { CreatePropertyCampaignBodyDto } from "../campaigns/dto/create-property-campaign.dto.js";
import { CreativePackageRepository } from "../creative-packages/infrastructure/creative-package.repository.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import {
  PendingActionRepository,
  type CreatePendingActionInput,
  type PendingActionRow,
} from "./infrastructure/pending-action.repository.js";

/**
 * `modules/pending-actions` (AAOS-OPERATING-MODE-APPROVAL-GATE) — the real human-approval gate for
 * a tenant in `APPROVAL` operating mode. Mirrors `LearningDecisionService`'s exact real composition
 * (the closest-in-shape precedent, per this task's own instruction): `listPending`/`approve`/
 * `reject`, both decision methods guarding on `status === 'PENDING'` before doing anything and
 * throwing a real `ConflictError` (409) for an already-decided row — never a silent re-decide.
 *
 * `enqueue()` is the real write path `SchedulerService.recordCampaignTriggerDecision` calls INSTEAD
 * OF `CampaignsService.createPropertyCampaign` when the tenant's `operating_mode` is `APPROVAL` —
 * it only ever inserts a `PENDING` row, never touches Meta.
 *
 * `approve()` is the ONLY method that ever calls `CampaignsService.createPropertyCampaign` from
 * this module — the SAME real method `CampaignsController`'s manual endpoint and
 * `SchedulerService`'s own `FULL_CONTROL`-mode path already call, never a second, parallel
 * campaign-creation code path. `reject()` is a real, deliberate no-op against every other real
 * side effect — it writes ONLY to `pending_agent_actions` (status/decided_by/decision_notes/
 * decided_at), same "Reject writes to the decision table, changes nothing else" framing
 * `LearningDecisionService.reject`'s own doc gives.
 *
 * Unlike `LearningController`'s `:id`-scoped routes (which act on the row's own `tenant_id` column
 * with no extra caller-tenant check — a real, documented precedent for a single-tenant deployment),
 * every method here additionally verifies the row belongs to the CALLING tenant (mirrors
 * `SchedulerService.findOrThrow`/`SettingsService.requireWaba`'s exact real pattern: a row that
 * exists but belongs to a different tenant is reported the SAME as a row that does not exist at
 * all) — this task's own instruction requires every new endpoint to be `@TenantId()`-scoped from
 * day one, so the service layer enforces that scoping itself rather than trusting callers.
 */
@Injectable()
export class PendingActionsService {
  private readonly logger = new Logger(PendingActionsService.name);

  constructor(
    private readonly pendingActions: PendingActionRepository,
    private readonly campaignsService: CampaignsService,
    // AAOS LOOP UPGRADE, Sprint 6 Prompt 17 — real audit_log writer. Best-effort
    // (`AuditLogService.record` never throws) so a logging failure can never turn a real
    // approve/reject decision into a failed request.
    private readonly auditLog: AuditLogService,
    private readonly modeGuard: ModeGuardService,
    /**
     * AAOS LOOP UPGRADE, Sprint 8a — real writer for the NEW `REVIEW_CREATIVE_BRIEF` action_type's
     * approve/reject effect (a real `creative_packages.status` transition, `PENDING_REVIEW ->
     * DRAFT` on approve, `PENDING_REVIEW -> REJECTED` on reject). Injected directly (not via
     * `CreativePackagesModule`, to avoid importing that module's own `ListingsModule`/
     * `ActivityLogModule`/etc. graph into this one) — the SAME "provide the leaf repository class
     * directly" pattern `SchedulerModule` already establishes for this exact repository.
     */
    private readonly creativePackageRepository: CreativePackageRepository,
    // Same real bug/fix `LearningDecisionService`/`GoLiveService` document on their own
    // constructors: a bare `Function`-typed param with a default still gets a real DI resolution
    // attempt from Nest without `@Optional()`.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  /** The real write path a gated caller (today: `SchedulerService`) uses to enqueue a pending action instead of executing it directly. Returns the new row's real id. */
  async enqueue(input: CreatePendingActionInput): Promise<string> {
    const row = await this.pendingActions.create(input);
    return row.id;
  }

  async listPending(tenantId: string, status?: string): Promise<readonly PendingActionRow[]> {
    return this.pendingActions.listForTenant(tenantId, status);
  }

  private async requireOwnedByTenant(id: string, tenantId: string): Promise<PendingActionRow> {
    const row = await this.pendingActions.findById(id);
    if (row === undefined || row.tenant_id !== tenantId) {
      throw new NotFoundError(`No pending_agent_actions row found with id "${id}"`);
    }
    return row;
  }

  /**
   * The real Approve write path. Two real, known `action_type`s today:
   *   - `CREATE_PROPERTY_CAMPAIGN` — its stored `payload` is passed straight through to the SAME
   *     real `CampaignsService.createPropertyCampaign` every other real caller uses (no second,
   *     parallel campaign-creation code path).
   *   - `REVIEW_CREATIVE_BRIEF` (AAOS LOOP UPGRADE, Sprint 8a) — a real, auto-generated
   *     (`source: 'auto_loop'`) `creative_packages` row the NEED_CREATIVE guardrail chain decided
   *     needs human review (`SchedulerService.runNeedCreativeCheck`). Approving it moves that row
   *     `PENDING_REVIEW -> DRAFT` (`CreativePackageRepository.approveReview`) — the SAME real,
   *     sendable `DRAFT` state a manual brief reaches, still requiring a separate, explicit
   *     `POST .../generate` before any real Kie AI spend (see `creative-package.ts`'s own doc).
   *     Never calls `CampaignsService` — `campaignResult` stays `undefined` for this branch, so the
   *     `CAMPAIGN_PUBLISHED` audit write below is correctly skipped.
   * An unrecognized `action_type` is a real, honest error (never a silent no-op that would mark the
   * row `APPROVED` without actually doing anything) — this module's generalized shape anticipates
   * future `action_type`s, but this phase only implements the 2 real gated actions that exist.
   */
  async approve(
    id: string,
    tenantId: string,
    decidedBy: string | undefined,
    decisionNotes: string | undefined,
  ): Promise<PendingActionRow> {
    const row = await this.requireOwnedByTenant(id, tenantId);
    if (row.status !== "PENDING") {
      throw new ConflictError(
        `pending_agent_actions "${id}" has status "${row.status}" — only a PENDING action can be approved`,
      );
    }

    let campaignResult: Awaited<ReturnType<CampaignsService["createPropertyCampaign"]>> | undefined;
    if (row.action_type === "CREATE_PROPERTY_CAMPAIGN") {
      const payload = row.payload as unknown as CreatePropertyCampaignBodyDto;
      campaignResult = await this.campaignsService.createPropertyCampaign(
        tenantId,
        payload,
        randomUUID(),
      );
    } else if (row.action_type === "REVIEW_CREATIVE_BRIEF") {
      const creativePackageId = row.payload["creativePackageId"];
      if (typeof creativePackageId !== "string") {
        throw new ConflictError(
          `pending_agent_actions "${id}" has a REVIEW_CREATIVE_BRIEF payload with no real "creativePackageId" — cannot approve.`,
        );
      }
      await this.creativePackageRepository.approveReview(
        creativePackageId,
        this.now().toISOString(),
      );
    } else {
      throw new ConflictError(
        `pending_agent_actions "${id}" has an unsupported action_type "${row.action_type}" — cannot approve.`,
      );
    }

    await this.pendingActions.updateDecision(
      id,
      "APPROVED",
      decidedBy,
      decisionNotes,
      this.now().toISOString(),
    );
    this.logger.log(`PendingActionsService.approve(${id}): real ${row.action_type} executed.`);

    // AAOS LOOP UPGRADE, Sprint 6 Prompt 17 — real audit_log write. `decided_by` is real
    // ('user_manual' — a human clicked Approve; nothing here ever auto-approves). Best-effort
    // (`AuditLogService.record` never throws), fired AFTER the real decision write above succeeded.
    const mode = await this.modeGuard.resolveMode(tenantId);
    await this.auditLog.record({
      tenantId,
      agent: row.agent,
      actionType: "VERDICT_APPLIED",
      beforeState: row.payload,
      afterState: campaignResult,
      decidedBy: "user_manual",
      ...(decidedBy !== undefined ? { userId: decidedBy } : {}),
      mode,
      relatedVerdictId: id,
      // Reversibility of the real underlying action (CREATE_PROPERTY_CAMPAIGN's real campaign
      // publish) is recorded on ITS OWN `CAMPAIGN_PUBLISHED` semantics, not duplicated here — this
      // VERDICT_APPLIED row records the human decision itself, which cannot itself be "rolled back"
      // (the decision already happened) — only the underlying campaign publish can be, so a second,
      // separate CAMPAIGN_PUBLISHED row records that when it is a real, non-simulated result.
      reversible: false,
    });
    if (
      campaignResult !== undefined &&
      !campaignResult.simulated &&
      campaignResult.campaignId !== undefined
    ) {
      await this.auditLog.record({
        tenantId,
        agent: row.agent,
        actionType: "CAMPAIGN_PUBLISHED",
        beforeState: null,
        afterState: campaignResult,
        decidedBy: "user_manual",
        ...(decidedBy !== undefined ? { userId: decidedBy } : {}),
        mode,
        relatedVerdictId: id,
        reversible: true,
      });
    }

    return this.requireOwnedByTenant(id, tenantId);
  }

  /**
   * Real Reject write path — touches ONLY `pending_agent_actions`, never `CampaignsService` or Meta
   * (`CREATE_PROPERTY_CAMPAIGN` rows: "Reject changes nothing else"). AAOS LOOP UPGRADE, Sprint 8a
   * — ONE additive exception: a `REVIEW_CREATIVE_BRIEF` row's real `creative_packages` row is moved
   * `PENDING_REVIEW -> REJECTED` (`review()`, the SAME terminal status a rejected GENERATED package
   * already reaches) so the brief does not stay stuck in limbo — an orphaned `PENDING_REVIEW` row
   * with no further real queue reference would be a genuine gap, not a "changes nothing else"
   * no-op.
   */
  async reject(
    id: string,
    tenantId: string,
    decidedBy: string | undefined,
    decisionNotes: string | undefined,
  ): Promise<PendingActionRow> {
    const row = await this.requireOwnedByTenant(id, tenantId);
    if (row.status !== "PENDING") {
      throw new ConflictError(
        `pending_agent_actions "${id}" has status "${row.status}" — only a PENDING action can be rejected`,
      );
    }
    if (row.action_type === "REVIEW_CREATIVE_BRIEF") {
      const creativePackageId = row.payload["creativePackageId"];
      if (typeof creativePackageId === "string") {
        await this.creativePackageRepository.review(
          creativePackageId,
          "REJECTED",
          this.now().toISOString(),
        );
      } else {
        this.logger.warn(
          `PendingActionsService.reject(${id}): REVIEW_CREATIVE_BRIEF payload has no real "creativePackageId" — the pending_agent_actions row is still rejected, but no creative_packages row was updated.`,
        );
      }
    }

    await this.pendingActions.updateDecision(
      id,
      "REJECTED",
      decidedBy,
      decisionNotes,
      this.now().toISOString(),
    );

    // AAOS LOOP UPGRADE, Sprint 6 Prompt 17 — real audit_log write. A reject never runs any real
    // Meta/campaign action (see this method's own doc), so `after_state` is honestly `null`.
    const mode = await this.modeGuard.resolveMode(tenantId);
    await this.auditLog.record({
      tenantId,
      agent: row.agent,
      actionType: "VERDICT_REJECTED",
      beforeState: row.payload,
      afterState: null,
      decidedBy: "user_manual",
      ...(decidedBy !== undefined ? { userId: decidedBy } : {}),
      mode,
      relatedVerdictId: id,
      reversible: false,
    });

    return this.requireOwnedByTenant(id, tenantId);
  }
}
