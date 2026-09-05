import { randomUUID } from "node:crypto";

import { ConflictError, NotFoundError } from "@aos/errors";
import { Injectable, Logger } from "@nestjs/common";

import { MetaAdsService } from "../meta-ads/meta-ads.service.js";

import {
  AuditLogRepository,
  type AuditLogRow,
  type CreateAuditLogInput,
} from "./infrastructure/audit-log.repository.js";

/**
 * `modules/audit-log` (AAOS LOOP UPGRADE, Sprint 6 Prompt 17) — real, separate decision trail from
 * `agent_activities`/`ActivityLogger`: that table records what an agent DID; this one records WHO
 * decided (`ai_auto`/`user_manual`) and whether the decision is reversible. See
 * `045_audit_log.sql`'s own header doc for the full "REAL WRITERS THIS PHASE WIRES" mapping — this
 * service is never called speculatively, only from those real, already-existing action handlers.
 *
 * `record()` is deliberately best-effort (never throws) — same "a logging failure must never fail
 * the real action it describes" discipline `ActivityLogger`'s own class doc establishes; every real
 * call site here fires it as a fire-and-forget tail of an already-succeeded real action, never
 * gating that action's own success/failure on this write landing.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly repository: AuditLogRepository,
    private readonly metaAdsService: MetaAdsService,
  ) {}

  /** Best-effort write — see this class's own doc for why a failure here is only logged, never thrown. */
  async record(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.repository.insert(input);
    } catch (caught) {
      this.logger.warn(`AuditLogService.record(${input.actionType}) failed: ${String(caught)}`);
    }
  }

  async list(tenantId: string, agent?: string): Promise<readonly AuditLogRow[]> {
    return this.repository.listForTenant(tenantId, { agent });
  }

  async get(tenantId: string, id: string): Promise<AuditLogRow> {
    const row = await this.repository.findById(tenantId, id);
    if (row === undefined) {
      throw new NotFoundError(`No audit_log row found with id "${id}"`);
    }
    return row;
  }

  /**
   * Real rollback — ONLY for `reversible = true` rows, which today means exactly one real
   * `action_type`: `CAMPAIGN_PUBLISHED` (see `045_audit_log.sql`'s own doc for the full "real
   * rollback coverage" reasoning). Reverts by calling the SAME real, already-existing
   * `MetaAdsService.executeVerdict({verdict: 'PAUSE', targetType: 'campaign'})` a manager pausing
   * that campaign anywhere else in this app already goes through — never a fabricated/parallel
   * "undo" call. `before_state`/`after_state` on the row this creates: `before_state` is the
   * original row's real `after_state` (the campaign as it stood before rollback — i.e. published/
   * active), `after_state` is the real `executeVerdict` result (paused). A row with
   * `reversible = false` throws a real `ConflictError` (409) — never a silent no-op that would look
   * like a successful rollback in the UI.
   */
  async rollback(
    tenantId: string,
    id: string,
    decidedBy: string | undefined,
  ): Promise<AuditLogRow> {
    const original = await this.get(tenantId, id);
    if (!original.reversible) {
      throw new ConflictError(
        `audit_log "${id}" (action_type "${original.action_type}") is not reversible — no real, safe rollback path exists for it (see 045_audit_log.sql's own doc).`,
      );
    }
    if (original.action_type !== "CAMPAIGN_PUBLISHED") {
      // Unreachable today (only CAMPAIGN_PUBLISHED rows are ever inserted with reversible = true —
      // see AuditLogService's real writers), but guarded explicitly rather than assumed, so a future
      // reversible row of an unhandled action_type fails loudly instead of silently mis-executing.
      throw new ConflictError(
        `audit_log "${id}" is marked reversible but action_type "${original.action_type}" has no real rollback implementation.`,
      );
    }
    const afterState = original.after_state as { readonly campaignId?: string } | null;
    const campaignId = afterState?.campaignId;
    if (campaignId === undefined || campaignId.length === 0) {
      throw new ConflictError(
        `audit_log "${id}" has no real campaignId recorded in after_state — cannot rollback.`,
      );
    }

    const result = await this.metaAdsService.executeVerdict(
      { verdict: "PAUSE", targetId: campaignId, targetType: "campaign" },
      randomUUID(),
      tenantId,
    );

    // A real, foreground write (unlike `record()`'s best-effort default) — a rollback whose own
    // audit row failed to persist must be reported to the caller as a real failure, never silently
    // swallowed into a "rollback succeeded" response the UI cannot trust.
    return this.repository.insert({
      tenantId,
      agent: original.agent,
      actionType: "ROLLBACK",
      beforeState: original.after_state,
      afterState: result,
      decidedBy: decidedBy !== undefined ? "user_manual" : "ai_auto",
      ...(decidedBy !== undefined ? { userId: decidedBy } : {}),
      mode: result.simulated ? "DEV" : "LIVE",
      relatedVerdictId: id,
      reversible: false,
    });
  }
}
