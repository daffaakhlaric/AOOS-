import { Injectable, Logger, Optional } from "@nestjs/common";

import {
  AgentConfigRepository,
  type AgentConfigRow,
} from "./infrastructure/agent-config.repository.js";

/**
 * `modules/agent-config` (AAOS Self-Improving, Phase SI-1). Deliberately a SMALL, STANDALONE
 * module — same "each module composes its own instance of a shared repository class over one
 * shared connection" pattern `modules/prompt-override`'s `PromptOverrideService` already
 * establishes for the exact real analogous concern (its class doc explains the precedent in full).
 *
 * `get(tenantId, agent, key, fallback)` resolves the real `agent_configs` row's numeric `value` for
 * `(tenantId, agent, key)` if one exists, else `fallback` UNCHANGED — so every existing hardcoded
 * threshold call site keeps behaving identically until a tenant actually has a real config row
 * (this phase's own migration seeds one matching each rewired threshold's current hardcoded value
 * exactly — zero behavior change on rollout).
 *
 * Fails open to `fallback` on ANY repository error OR a real non-numeric `value` (defensive: this
 * table's `value` column is free TEXT, per `034_agent_configs.sql`'s own doc) — same "never turn a
 * transient config-table read failure into every request failing" discipline
 * `PromptOverrideService.resolve` already establishes. Logged as a warning, never thrown.
 */
@Injectable()
export class AgentConfigService {
  private readonly logger = new Logger(AgentConfigService.name);

  constructor(
    private readonly repository: AgentConfigRepository,
    // Same real bug/fix `PromptOverrideService`/`GoLiveService` document on their own
    // constructors: a bare `Function`-typed param with a default still gets a real DI resolution
    // attempt from Nest without `@Optional()`.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * AAOS Self-Improving, Phase SI-6 — real, thin delegation to
   * `AgentConfigRepository.listForTenant`, the Learning Monitor's real Config editor "view current
   * values" read. Deliberately does NOT catch/degrade to `[]` on a repository error (unlike `get`'s
   * own fail-open discipline) — `get`'s fail-open exists so a transient read failure never breaks an
   * unrelated real threshold lookup mid-request; this method is a direct, human-facing "show me the
   * real config table" read where a real error should surface honestly to the caller (the Learning
   * Monitor UI), not be silently swallowed into a misleading empty list.
   */
  async listForTenant(tenantId: string): Promise<readonly AgentConfigRow[]> {
    return this.repository.listForTenant(tenantId);
  }

  async get(tenantId: string, agent: string, key: string, fallback: number): Promise<number> {
    try {
      const row = await this.repository.findByKey(tenantId, agent, key);
      if (row === undefined) {
        return fallback;
      }
      const parsed = Number(row.value);
      if (!Number.isFinite(parsed)) {
        this.logger.warn(
          `AgentConfigService.get(${tenantId}, ${agent}, ${key}): stored value "${row.value}" is not a real finite number — falling back to the hardcoded default.`,
        );
        return fallback;
      }
      return parsed;
    } catch (caught) {
      this.logger.warn(
        `AgentConfigService.get(${tenantId}, ${agent}, ${key}) failed to read agent_configs — falling back to the hardcoded default: ${String(caught)}`,
      );
      return fallback;
    }
  }

  /**
   * Real upsert write path — the ONLY method that ever writes an `agent_configs` row (a human
   * Config editor action, Phase SI-6, or `ConfigApplierService.applyConfigUpdate`'s real auto-apply
   * write, Phase SI-1). Deliberately does NOT catch/degrade — the same "let the write error
   * propagate uncaught, the caller decides whether to make it best-effort" discipline
   * `PromptOverrideService.applyApproved` already establishes; `ConfigApplierService` is this
   * service's own real best-effort boundary.
   */
  async set(
    tenantId: string,
    agent: string,
    key: string,
    value: number,
    updatedBy?: string,
  ): Promise<AgentConfigRow> {
    return this.repository.upsert({
      tenantId,
      agent,
      configKey: key,
      value: String(value),
      dataType: "number",
      updatedAt: this.now().toISOString(),
      ...(updatedBy !== undefined ? { updatedBy } : {}),
    });
  }
}
