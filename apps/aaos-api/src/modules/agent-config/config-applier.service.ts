import { Injectable, Logger } from "@nestjs/common";

import type { ImprovementItem } from "../llm/dto/improvement-plan.dto.js";
import { KNOWN_CONFIG_KEYS } from "../llm/llm.service.js";

import { AgentConfigService } from "./agent-config.service.js";

/** A real `updated_by` marker (`agent_configs.updated_by`) — never a human identifier, always honest about who actually wrote the value. */
const AUTO_APPLY_ACTOR = "AI_AUTO_APPLY";

export interface ApplyConfigUpdateResult {
  readonly applied: boolean;
  /** Present only when `applied === false` — a real, honest reason, never silently swallowed. */
  readonly reason?: string;
}

/**
 * `ConfigApplierService` (AAOS Self-Improving, Phase SI-1) — the real, AUTOMATIC (no human
 * approval) write path for a `CONFIG_UPDATE` improvement item, per the user's own explicit,
 * twice-confirmed decision (`docs/PROMPT-AAOS-SELF-IMPROVING-FULL.md`'s own header: "FULL
 * auto-apply for ALL types ... no human gate"). This is the CONFIG_UPDATE sibling of
 * `PromptOverrideService.applyApproved` — but unlike that method (called ONLY from
 * `LearningDecisionService.approve`, ONLY after a real human Approve action), THIS method is called
 * automatically, immediately after a `learning_proposals` row is persisted
 * (`LearningService.persistProposal`) — no human step in between, by design.
 *
 * BEST-EFFORT DISCIPLINE (same as every other side-effect in this codebase, e.g.
 * `SchedulerService.countHotLeads`/`AiJudgeService.judgeRun`): a write failure here must NEVER
 * throw — it is caught, logged, and reported back as `{ applied: false, reason }` so the caller
 * (`LearningService.persistProposal`) can honestly record on the proposal row which items were
 * actually applied vs which were not, without ever failing the proposal-generation flow itself.
 *
 * Validates `item.target` against `KNOWN_CONFIG_KEYS` (belt) — the SAME real, server-side
 * known-key check `LlmService.generateImprovementPlan` already performs before a `CONFIG_UPDATE`
 * item is ever persisted (braces) — an unknown target is a real, honest no-op here too, never
 * silently written to `agent_configs` under an unvalidated key.
 */
@Injectable()
export class ConfigApplierService {
  private readonly logger = new Logger(ConfigApplierService.name);

  constructor(private readonly agentConfig: AgentConfigService) {}

  async applyConfigUpdate(
    tenantId: string,
    item: ImprovementItem,
  ): Promise<ApplyConfigUpdateResult> {
    if (item.type !== "CONFIG_UPDATE") {
      return { applied: false, reason: `type "${item.type}" is not CONFIG_UPDATE` };
    }
    if (!KNOWN_CONFIG_KEYS.includes(item.target)) {
      this.logger.warn(
        `ConfigApplierService.applyConfigUpdate(${tenantId}): target "${item.target}" is not a known config key (${KNOWN_CONFIG_KEYS.join(", ")}) — no-op.`,
      );
      return { applied: false, reason: `unknown config key "${item.target}"` };
    }
    const parsedValue = Number(item.after);
    if (!Number.isFinite(parsedValue)) {
      this.logger.warn(
        `ConfigApplierService.applyConfigUpdate(${tenantId}): item.after "${item.after}" for target "${item.target}" is not a real finite number — no-op.`,
      );
      return { applied: false, reason: `non-numeric value "${item.after}"` };
    }
    try {
      await this.agentConfig.set(tenantId, item.agent, item.target, parsedValue, AUTO_APPLY_ACTOR);
      this.logger.log(
        `ConfigApplierService.applyConfigUpdate(${tenantId}): AUTO-APPLIED ${item.agent}/${item.target} = ${parsedValue} (no human approval — see this class's own doc).`,
      );
      return { applied: true };
    } catch (caught) {
      this.logger.warn(
        `ConfigApplierService.applyConfigUpdate(${tenantId}): write to agent_configs failed for ${item.agent}/${item.target} — best-effort, proposal generation continues: ${String(caught)}`,
      );
      return { applied: false, reason: `write failed: ${String(caught)}` };
    }
  }
}
