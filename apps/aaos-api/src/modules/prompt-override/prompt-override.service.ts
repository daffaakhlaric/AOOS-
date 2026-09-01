import { ConflictError } from "@aos/errors";
import { Injectable, Logger, Optional } from "@nestjs/common";

import {
  PromptOverrideRepository,
  type PromptOverrideRow,
} from "./infrastructure/prompt-override.repository.js";

/**
 * `modules/prompt-override` (AAOS Self-Learning AI, Phase A — DB-backed prompt/config override
 * layer). Deliberately a SMALL, STANDALONE module, mirroring `modules/webhook-config`'s
 * `WebhookSecretsService` and `modules/mode-guard`'s `ModeGuardService` precedent (see either
 * class's doc): `PromptOverrideService`'s real consumers (`LlmModule`) must never need to import a
 * bigger module just to reach it, and this keeps the same "each module composes its own instance
 * of a shared repository class over one shared connection" pattern those two modules establish.
 *
 * `resolve(tenantId, agent, promptKey, fallback)` returns the active `agent_prompt_overrides` row's
 * `content` for `(tenantId, agent, promptKey)` if one exists, else `fallback` UNCHANGED — so every
 * existing `LlmService` call site keeps behaving identically until a tenant actually has an active
 * override row (nothing in this phase creates one; that's Phase C, a separate, later effort).
 *
 * Deliberately NO caching layer (unlike `WebhookSecretsService`'s in-memory cache): a real DB read
 * per call, same "keep it simple, this phase does not need it" instruction the coordinator note
 * gives explicitly. Revisit if this read path becomes hot — every `LlmService` method already pays
 * one OpenAI round trip per non-cached call, so one extra indexed Supabase read is not the dominant
 * cost today.
 *
 * Fails open to `fallback` on ANY repository error (network hiccup, table not yet migrated) — same
 * "never turn a transient config-table read failure into every request failing" discipline
 * `WebhookSecretsService.getRowSafely`/`ModeGuardService.resolveMode` both already establish.
 * Logged as a warning, never thrown.
 */
@Injectable()
export class PromptOverrideService {
  private readonly logger = new Logger(PromptOverrideService.name);

  constructor(
    private readonly repository: PromptOverrideRepository,
    // Same real bug/fix `GoLiveService` documents on its own constructor: a bare `Function`-typed
    // param with a default still gets a real DI resolution attempt from Nest without `@Optional()`.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  async resolve(
    tenantId: string,
    agent: string,
    promptKey: string,
    fallback: string,
  ): Promise<string> {
    try {
      const row = await this.repository.findActive(tenantId, agent, promptKey);
      return row?.content ?? fallback;
    } catch (caught) {
      this.logger.warn(
        `PromptOverrideService.resolve(${tenantId}, ${agent}, ${promptKey}) failed to read agent_prompt_overrides — falling back to the hardcoded default: ${String(caught)}`,
      );
      return fallback;
    }
  }

  /**
   * AAOS Self-Learning AI, Phase C — the human-approval gate's real write path. Called ONLY from
   * `LearningDecisionService.approve`, and only after a real human Approve action reaches that
   * service — this method (and `rollback` below) is the ONLY place anywhere in this whole effort
   * that ever creates/activates an `agent_prompt_overrides` row, per the design doc's own "Phase C
   * — the ONLY point ... a row is created/activated" framing.
   *
   * REAL SEQUENCING (no transaction precedent exists anywhere in this codebase's Supabase usage —
   * grepped the whole `apps/aaos-api/src` tree for `.rpc(`/`BEGIN`/`transaction`, zero real hits;
   * every other repository in this app performs one `.update()`/`.insert()` at a time with no
   * cross-statement atomicity, so this method honestly does the same rather than pretending a
   * transaction exists): (1) look up the current active row, if any; (2) DEACTIVATE it FIRST and
   * let that write's own error propagate uncaught — the new row is inserted ONLY once that
   * deactivate has actually succeeded; (3) THEN insert the new, already-active row. Never the
   * reverse order — a crash between steps 2 and 3 leaves this `(tenantId, agent, promptKey)` with
   * NO active row (safe: `PromptOverrideService.resolve` falls back to the hardcoded default, per
   * that method's own doc) rather than risking TWO active rows, which insert-then-deactivate could
   * leave behind on a crash between its own two steps.
   */
  async applyApproved(
    tenantId: string,
    agent: string,
    promptKey: string,
    content: string,
  ): Promise<PromptOverrideRow> {
    const nowIso = this.now().toISOString();
    const current = await this.repository.findActive(tenantId, agent, promptKey);
    if (current !== undefined) {
      await this.repository.deactivate(current.id, nowIso);
    }
    const versions = await this.repository.listVersions(tenantId, agent, promptKey);
    const maxVersion = versions.reduce((max, row) => Math.max(max, row.version), 0);
    return this.repository.insert({
      tenantId,
      agent,
      promptKey,
      content,
      version: maxVersion + 1,
      activatedAt: nowIso,
    });
  }

  /**
   * AAOS Self-Learning AI, Phase C, Finding #6 — a real, manual, auditable rollback (never an
   * automatic score-triggered one). Deactivates the current active row and reactivates the
   * previous version for `(tenantId, agent, promptKey)`, if one exists; when the just-approved row
   * was version 1 (no previous version), leaves it deactivated with no new active row — which
   * makes `PromptOverrideService.resolve` fall back to the hardcoded default again, verified
   * directly against that method's own real fallback behavior (its `??` on `row?.content`) rather
   * than assumed.
   *
   * Throws `ConflictError` when there is no active row to roll back for this key — never a silent
   * no-op, and never invents a version to reactivate.
   */
  async rollback(
    tenantId: string,
    agent: string,
    promptKey: string,
  ): Promise<{ readonly rolledBackToVersion: number | null }> {
    const current = await this.repository.findActive(tenantId, agent, promptKey);
    if (current === undefined) {
      throw new ConflictError(
        `No active agent_prompt_overrides row exists for (${tenantId}, ${agent}, ${promptKey}) to roll back`,
      );
    }
    const nowIso = this.now().toISOString();
    await this.repository.deactivate(current.id, nowIso);

    const versions = await this.repository.listVersions(tenantId, agent, promptKey);
    const previous = versions
      .filter((row) => row.id !== current.id && row.version < current.version)
      .reduce<PromptOverrideRow | undefined>(
        (best, row) => (best === undefined || row.version > best.version ? row : best),
        undefined,
      );
    if (previous === undefined) {
      return { rolledBackToVersion: null };
    }
    await this.repository.reactivate(previous.id, nowIso);
    return { rolledBackToVersion: previous.version };
  }

  /** Every currently-active override for a tenant — the Learning Monitor's "what's live right now" table. */
  async listActiveForTenant(tenantId: string): Promise<readonly PromptOverrideRow[]> {
    return this.repository.listActiveForTenant(tenantId);
  }
}
