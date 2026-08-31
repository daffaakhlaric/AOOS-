import { Injectable, Logger } from "@nestjs/common";

import type { TenantMode } from "../mode-guard/mode-guard.service.js";

import {
  ActivityRepository,
  type ActivityRow,
  type ActivityToolCallEntry,
} from "./infrastructure/activity.repository.js";

export type ActivityStatus = "RUNNING" | "SUCCESS" | "SIMULATED" | "ERROR";

export interface StartActivityInput {
  readonly tenantId: string;
  readonly agent: string;
  readonly actionType: string;
  /** The tenant's real mode AT START TIME, per `ModeGuardService.resolveMode` — never guessed separately (design doc's own requirement). */
  readonly mode: TenantMode;
  readonly loopId?: string;
  readonly input?: unknown;
}

export interface CompleteActivityInput {
  /** `SUCCESS` for a real LIVE-mode run, `SIMULATED` for a DEV-mode run — the caller decides based on the SAME real outcome `ModeGuardService.executeOrSimulate` already produced (e.g. a response DTO's own `simulated` field), never re-guessed independently. */
  readonly status: "SUCCESS" | "SIMULATED";
  readonly output?: unknown;
  readonly devPreview?: unknown;
}

/**
 * `modules/activity-log` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B) — real, per-action agent
 * activity logging: one `agent_activities` row per gated action, written via plain
 * `ActivityRepository` inserts/updates (NEVER a manual `supabase.channel(...).send({ type:
 * "broadcast", ... })` — see `021_agent_activities.sql`'s header doc for the corrected-from-spec
 * realtime mechanism: the dashboard observes these via a real `postgres_changes` subscription on
 * the plain INSERT this class's own `start()` performs).
 *
 * `start()` inserts a `RUNNING` row and returns its id; `logToolCall()`/`logReasoning()` patch
 * that same row in place (never a second row); `complete()`/`fail()` are the two real terminal
 * writes, stamping `completed_at`/`duration_ms` off `started_at`.
 *
 * EVERY method here is best-effort — logging a real agent action must never be the reason the
 * real action itself fails. Same "never turn a side-effect logging failure into a hard failure on
 * a path that must keep working" discipline `AdTenantIndexRepository`'s own indexing / this app's
 * `WebhookSecretsService.getRowSafely` already establish (see `MetaAdsService.pullCampaigns`'s
 * `indexPulledAdAccount` call for the precedent this mirrors). `start()` returns `undefined` when
 * the insert itself fails (caught + warned, not thrown); `complete()`/`fail()`/`logToolCall()`/
 * `logReasoning()` accept that `undefined` and no-op — a caller never needs its own try/catch
 * around any of these calls.
 */
@Injectable()
export class ActivityLogger {
  private readonly logger = new Logger(ActivityLogger.name);

  constructor(private readonly activities: ActivityRepository) {}

  async start(input: StartActivityInput): Promise<string | undefined> {
    try {
      const row = await this.activities.insert({
        tenant_id: input.tenantId,
        loop_id: input.loopId ?? null,
        agent: input.agent,
        action_type: input.actionType,
        mode: input.mode,
        status: "RUNNING",
        input: input.input ?? null,
        output: null,
        dev_preview: null,
        reasoning: null,
        tool_calls: [],
        started_at: new Date().toISOString(),
      });
      return row.id;
    } catch (caught) {
      this.logger.warn(`ActivityLogger.start(${input.actionType}) failed: ${String(caught)}`);
      return undefined;
    }
  }

  /** Appends one real tool-call entry to `tool_calls` (read-modify-write — this table has no atomic JSONB array-append in the shared `SupabaseClientLike` port, same constraint every other JSONB-array-holding repository in this app works within). Best-effort: a logging failure here must never fail the real agent action it's describing, so it's caught and warned, never thrown. No-ops silently when `activityId` is `undefined` (the row-level `start()` call that would have produced it already failed and warned). */
  async logToolCall(
    activityId: string | undefined,
    entry: Omit<ActivityToolCallEntry, "at">,
  ): Promise<void> {
    if (activityId === undefined) {
      return;
    }
    try {
      const row = await this.activities.findById(activityId);
      if (row === undefined) {
        this.logger.warn(`ActivityLogger.logToolCall(${activityId}): row not found — dropping`);
        return;
      }
      const toolCalls: ActivityToolCallEntry[] = [
        ...row.tool_calls,
        { ...entry, at: new Date().toISOString() },
      ];
      await this.activities.updateById(activityId, { tool_calls: toolCalls });
    } catch (caught) {
      this.logger.warn(`ActivityLogger.logToolCall(${activityId}) failed: ${String(caught)}`);
    }
  }

  /** Sets/overwrites the row's real `reasoning` text. Best-effort, same "never fail the real action" discipline as `logToolCall`. No-ops silently when `activityId` is `undefined`. */
  async logReasoning(activityId: string | undefined, reasoning: string): Promise<void> {
    if (activityId === undefined) {
      return;
    }
    try {
      await this.activities.updateById(activityId, { reasoning });
    } catch (caught) {
      this.logger.warn(`ActivityLogger.logReasoning(${activityId}) failed: ${String(caught)}`);
    }
  }

  /** Terminal write for a real (non-error) outcome — `SUCCESS` (LIVE) or `SIMULATED` (DEV). Best-effort, same discipline as every other method here; no-ops (returns `undefined`) when `activityId` is `undefined` or the write itself fails. */
  async complete(
    activityId: string | undefined,
    input: CompleteActivityInput,
  ): Promise<ActivityRow | undefined> {
    return this.finish(activityId, {
      status: input.status,
      output: input.output ?? null,
      dev_preview: input.devPreview ?? null,
    });
  }

  /** Terminal write for a real failure — records the actual thrown error's message/stack, never a fabricated/generic one. Best-effort, same discipline as `complete`. */
  async fail(activityId: string | undefined, error: unknown): Promise<ActivityRow | undefined> {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? null) : null;
    return this.finish(activityId, {
      status: "ERROR",
      error_message: message,
      error_stack: stack,
    });
  }

  private async finish(
    activityId: string | undefined,
    values: {
      readonly status: ActivityStatus;
      readonly output?: unknown;
      readonly dev_preview?: unknown;
      readonly error_message?: string;
      readonly error_stack?: string | null;
    },
  ): Promise<ActivityRow | undefined> {
    if (activityId === undefined) {
      return undefined;
    }
    try {
      const row = await this.activities.findById(activityId);
      const startedAtMs = row !== undefined ? new Date(row.started_at).getTime() : Date.now();
      const completedAt = new Date();
      return await this.activities.updateById(activityId, {
        status: values.status,
        ...(values.output !== undefined ? { output: values.output } : {}),
        ...(values.dev_preview !== undefined ? { dev_preview: values.dev_preview } : {}),
        ...(values.error_message !== undefined ? { error_message: values.error_message } : {}),
        ...(values.error_stack !== undefined ? { error_stack: values.error_stack } : {}),
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAtMs,
      });
    } catch (caught) {
      this.logger.warn(
        `ActivityLogger: terminal write (${values.status}) for ${activityId} failed: ${String(caught)}`,
      );
      return undefined;
    }
  }
}
