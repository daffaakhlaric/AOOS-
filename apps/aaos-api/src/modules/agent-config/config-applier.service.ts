import { Injectable, Logger } from "@nestjs/common";

import type { ImprovementItem } from "../llm/dto/improvement-plan.dto.js";
import { KNOWN_CONFIG_KEYS } from "../llm/llm.service.js";

import { AgentConfigService } from "./agent-config.service.js";

/** A real `updated_by` marker (`agent_configs.updated_by`) — never a human identifier, always honest about who actually wrote the value. */
const AUTO_APPLY_ACTOR = "AI_AUTO_APPLY";

/**
 * AAOS Self-Improving, Phase SI-5 — the ONE honest, additional safety check this phase adds for
 * `CONFIG_UPDATE` (investigated per this phase's own coordinator instruction: a real sandbox test
 * for `CONFIG_UPDATE` would be FABRICATED — `SandboxService`'s own class doc already verified
 * directly that neither real `KNOWN_CONFIG_KEYS` value is ever read by `LlmService.analyze` itself,
 * so there is nothing real a sandbox re-run of `analyze` could honestly measure for a config change;
 * this class deliberately does NOT invent one).
 *
 * A cheap, real, RELATIVE-magnitude bounds check instead: an auto-applied value more than
 * `MAX_RELATIVE_CONFIG_DELTA`× larger, or smaller than 1/`MAX_RELATIVE_CONFIG_DELTA`× the value
 * `AgentConfigService.get` currently resolves for this exact `(tenantId, agent, target)` (the REAL
 * live value, not the LLM's own possibly-wrong `item.before` claim) is blocked. `5` is a real,
 * documented judgment call (not derived from any historical data — none exists yet for these 2
 * config keys): a genuine, well-reasoned tuning proposal for `pause_cpl_multiplier` (current default
 * `1.5`) or `live_run_gap_threshold` (current default `60`) should plausibly land within a 5×
 * envelope of the current value; a proposal outside it (e.g. a multiplier of `500`, or a threshold
 * of `-40` or `1e9`) is far more likely an LLM formatting/reasoning mistake than a deliberate,
 * defensible tuning change.
 *
 * HONEST LIMITATION, DOCUMENTED (per this phase's own coordinator instruction — never overstate what
 * a cheap check catches): this ONLY catches a WILDLY out-of-range value. It does NOT — and cannot —
 * validate that an in-range value is actually a GOOD tuning choice (e.g. a `pause_cpl_multiplier` of
 * `2.5` instead of a "correct" `1.6` sails straight through this check, unflagged) — that would
 * require the same real content-quality judgment `SandboxService`'s own class doc already found the
 * judge machinery cannot honestly provide for a config change. This check exists ONLY to catch a
 * gross, structurally-implausible mistake, never to certify a value as "right".
 */
const MAX_RELATIVE_CONFIG_DELTA = 5;

/**
 * The exact current hardcoded defaults `034_agent_configs.sql` seeded (see that migration's own
 * header doc) — restated here (not cross-imported from `learning.service.ts`'s own private
 * `LIVE_RUN_GAP_THRESHOLD` constant) so `AgentConfigService.get`'s fallback in the bounds check below
 * always resolves the REAL current live value for a tenant with no override row yet, same "resolve
 * via the real get-with-fallback path, never assume a value" discipline this whole effort follows.
 */
const KNOWN_CONFIG_KEY_DEFAULTS: Record<string, number> = {
  pause_cpl_multiplier: 1.5,
  live_run_gap_threshold: 60,
};

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
 * AAOS Self-Improving, Phase SI-5 real addition — `MAX_RELATIVE_CONFIG_DELTA`'s own bounds check
 * (see that constant's own doc for exactly what it catches and what it deliberately does not).
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

    // AAOS Self-Improving (Phase SI-5) — real, honest bounds check (see `MAX_RELATIVE_CONFIG_DELTA`'s
    // own doc for exactly what this catches and does not catch). Reads the REAL current live value
    // via the same `AgentConfigService.get` get-with-fallback path every other real config read in
    // this codebase uses — never trusts the LLM's own `item.before` claim, which could itself be
    // stale or wrong.
    const currentValue = await this.agentConfig.get(
      tenantId,
      item.agent,
      item.target,
      KNOWN_CONFIG_KEY_DEFAULTS[item.target] ?? parsedValue,
    );
    if (currentValue !== 0) {
      const ratio = parsedValue / currentValue;
      const outOfRange = ratio > MAX_RELATIVE_CONFIG_DELTA || ratio < 1 / MAX_RELATIVE_CONFIG_DELTA;
      if (outOfRange) {
        this.logger.warn(
          `ConfigApplierService.applyConfigUpdate(${tenantId}): target "${item.target}" proposed value ${String(parsedValue)} is more than ${String(MAX_RELATIVE_CONFIG_DELTA)}x away from the current real value ${String(currentValue)} (ratio=${String(ratio)}) — blocked as a real, honest bounds check (see MAX_RELATIVE_CONFIG_DELTA's own doc), no-op.`,
        );
        return {
          applied: false,
          reason: `proposed value ${String(parsedValue)} is more than ${String(MAX_RELATIVE_CONFIG_DELTA)}x away from the current value ${String(currentValue)}`,
        };
      }
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
