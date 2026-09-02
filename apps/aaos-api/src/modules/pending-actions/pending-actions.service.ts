import { randomUUID } from "node:crypto";

import { ConflictError, NotFoundError } from "@aos/errors";
import { Injectable, Logger, Optional } from "@nestjs/common";

import { CampaignsService } from "../campaigns/campaigns.service.js";
import type { CreatePropertyCampaignBodyDto } from "../campaigns/dto/create-property-campaign.dto.js";

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
   * The real Approve write path. Only real, known `action_type` today is
   * `CREATE_PROPERTY_CAMPAIGN` — its stored `payload` is passed straight through to the SAME real
   * `CampaignsService.createPropertyCampaign` every other real caller uses (no second, parallel
   * campaign-creation code path). An unrecognized `action_type` is a real, honest error (never a
   * silent no-op that would mark the row `APPROVED` without actually doing anything) — this module's
   * generalized shape anticipates future `action_type`s, but this phase only implements the one real
   * gated action that exists.
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

    if (row.action_type === "CREATE_PROPERTY_CAMPAIGN") {
      const payload = row.payload as unknown as CreatePropertyCampaignBodyDto;
      await this.campaignsService.createPropertyCampaign(tenantId, payload, randomUUID());
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
    return this.requireOwnedByTenant(id, tenantId);
  }

  /** Real Reject write path — touches ONLY `pending_agent_actions`, never `CampaignsService` or Meta. */
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
    await this.pendingActions.updateDecision(
      id,
      "REJECTED",
      decidedBy,
      decisionNotes,
      this.now().toISOString(),
    );
    return this.requireOwnedByTenant(id, tenantId);
  }
}
