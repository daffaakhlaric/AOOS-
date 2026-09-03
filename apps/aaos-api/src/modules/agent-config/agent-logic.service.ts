import { Injectable, Logger, Optional } from "@nestjs/common";

import {
  AgentLogicRepository,
  type AgentLogicRow,
} from "./infrastructure/agent-logic.repository.js";
import { isWellFormedLogicRuleSet, type LogicRuleSet } from "./logic-interpreter.js";

/**
 * `AgentLogicService` (AAOS Self-Improving, Phase SI-2) — the `LOGIC_UPDATE` sibling of Phase
 * SI-1's real `AgentConfigService`, same real "small, standalone, get-with-fallback" shape (see
 * that class's own doc for the full precedent this mirrors).
 *
 * `get(tenantId, agent, logicKey)` resolves the real `agent_logic` row's `definition` for
 * `(tenantId, agent, logicKey)` if one exists AND is a real, well-formed `LogicRuleSet`
 * (`isWellFormedLogicRuleSet` — `logic-interpreter.ts`'s own structural validator), else
 * `undefined` — NEVER a fabricated default ruleset. Unlike `AgentConfigService.get` (which always
 * has a real numeric `fallback` to degrade to), there is no honest generic "default ruleset" for
 * arbitrary declarative logic — `undefined` here means exactly what it means at every real call
 * site: "no real override exists (or it's malformed) — keep using whatever the real, existing,
 * hardcoded decision logic already does," the same "zero behavior change until a real row exists"
 * discipline `034_agent_configs.sql`'s own seed-row doc documents for `agent_configs`.
 *
 * Fails open to `undefined` on ANY repository error OR a real malformed `definition` — same "never
 * turn a transient read failure or a bad stored payload into every request failing" discipline
 * `AgentConfigService.get` already establishes. Logged as a warning, never thrown.
 */
@Injectable()
export class AgentLogicService {
  private readonly logger = new Logger(AgentLogicService.name);

  constructor(
    private readonly repository: AgentLogicRepository,
    // Same real DI-resolution bug/fix `AgentConfigService`/`PromptOverrideService`/`GoLiveService`
    // each document on their own constructors.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  async get(tenantId: string, agent: string, logicKey: string): Promise<LogicRuleSet | undefined> {
    try {
      const row = await this.repository.findByKey(tenantId, agent, logicKey);
      if (row === undefined) {
        return undefined;
      }
      if (!isWellFormedLogicRuleSet(row.definition)) {
        this.logger.warn(
          `AgentLogicService.get(${tenantId}, ${agent}, ${logicKey}): stored definition is not a real, well-formed LogicRuleSet — ignoring, real caller keeps its existing hardcoded logic unchanged.`,
        );
        return undefined;
      }
      return row.definition;
    } catch (caught) {
      this.logger.warn(
        `AgentLogicService.get(${tenantId}, ${agent}, ${logicKey}) failed to read agent_logic — falling back to no override: ${String(caught)}`,
      );
      return undefined;
    }
  }

  /**
   * Real upsert write path — the ONLY method that ever writes an `agent_logic` row (a human editor
   * action, or `LogicApplierService.applyLogicUpdate`'s real auto-apply write, Phase SI-2).
   * Deliberately does NOT catch/degrade — same "let the write error propagate uncaught, the caller
   * decides whether to make it best-effort" discipline `AgentConfigService.set` already establishes;
   * `LogicApplierService` is this service's own real best-effort boundary.
   */
  async set(
    tenantId: string,
    agent: string,
    logicKey: string,
    definition: LogicRuleSet,
    updatedBy?: string,
  ): Promise<AgentLogicRow> {
    return this.repository.upsert({
      tenantId,
      agent,
      logicKey,
      definition,
      updatedAt: this.now().toISOString(),
      ...(updatedBy !== undefined ? { updatedBy } : {}),
    });
  }
}
