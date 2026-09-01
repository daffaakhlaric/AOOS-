import { Injectable, Logger } from "@nestjs/common";

import { PromptOverrideRepository } from "./infrastructure/prompt-override.repository.js";

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

  constructor(private readonly repository: PromptOverrideRepository) {}

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
}
