import { Injectable, Logger } from "@nestjs/common";

import type { ImprovementItem } from "../llm/dto/improvement-plan.dto.js";
import { KNOWN_LOGIC_KEYS } from "../llm/llm.service.js";

import { AgentLogicService } from "./agent-logic.service.js";
import { isWellFormedLogicRuleSet } from "./logic-interpreter.js";

/** Same real, honest `updated_by` marker `ConfigApplierService.AUTO_APPLY_ACTOR` uses — never a human identifier. */
const AUTO_APPLY_ACTOR = "AI_AUTO_APPLY";

export interface ApplyLogicUpdateResult {
  readonly applied: boolean;
  /** Present only when `applied === false` — a real, honest reason, never silently swallowed. */
  readonly reason?: string;
}

/**
 * Real, safe `JSON.parse` boundary for `item.after` — plain, standard JSON parsing, NEVER
 * `eval`/`new Function`/any form of executing the LLM-authored text as code. Returns `undefined`
 * (never throws) on malformed JSON, the same honest degrade every other JSON-authored-text boundary
 * in this codebase (e.g. `LlmService`'s own `safeJsonParse`) already establishes.
 */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * `LogicApplierService` (AAOS Self-Improving, Phase SI-2) — the real, AUTOMATIC (no human approval)
 * write path for a `LOGIC_UPDATE` improvement item, the exact `agent_logic` sibling of Phase SI-1's
 * `ConfigApplierService.applyConfigUpdate` (same class doc precedent — see that class for the full
 * "why automatic, why best-effort" reasoning, per the user's own explicit, twice-confirmed decision
 * in `docs/PROMPT-AAOS-SELF-IMPROVING-FULL.md`'s own header).
 *
 * The ONE real, additional safety step this class adds beyond `ConfigApplierService`'s own shape:
 * `item.after` is real, untrusted JSON TEXT (an LLM- or human-authored candidate
 * `agent_logic.definition`), parsed via plain `JSON.parse` (never `eval`/`new Function` — see
 * `safeJsonParse`'s own doc) and then structurally validated via
 * `logic-interpreter.ts`'s own `isWellFormedLogicRuleSet` BEFORE it is ever persisted — a malformed
 * or non-JSON `after` value is a real, honest no-op here, the same "belt-and-braces, never trust an
 * LLM's output shape blindly" discipline `ConfigApplierService`'s own `KNOWN_CONFIG_KEYS` check and
 * non-numeric-value guard already establish for `CONFIG_UPDATE`.
 *
 * Validates `item.target` against `KNOWN_LOGIC_KEYS` (belt) — the SAME real, server-side known-key
 * check `LlmService.generateImprovementPlan` already performs before a `LOGIC_UPDATE` item is ever
 * persisted (braces).
 */
@Injectable()
export class LogicApplierService {
  private readonly logger = new Logger(LogicApplierService.name);

  constructor(private readonly agentLogic: AgentLogicService) {}

  async applyLogicUpdate(tenantId: string, item: ImprovementItem): Promise<ApplyLogicUpdateResult> {
    if (item.type !== "LOGIC_UPDATE") {
      return { applied: false, reason: `type "${item.type}" is not LOGIC_UPDATE` };
    }
    if (!KNOWN_LOGIC_KEYS.includes(item.target)) {
      this.logger.warn(
        `LogicApplierService.applyLogicUpdate(${tenantId}): target "${item.target}" is not a known logic key (${KNOWN_LOGIC_KEYS.join(", ")}) — no-op.`,
      );
      return { applied: false, reason: `unknown logic key "${item.target}"` };
    }
    const parsed = safeJsonParse(item.after);
    if (!isWellFormedLogicRuleSet(parsed)) {
      this.logger.warn(
        `LogicApplierService.applyLogicUpdate(${tenantId}): item.after for target "${item.target}" is not a real, well-formed LogicRuleSet — no-op (never persisted).`,
      );
      return { applied: false, reason: "malformed or non-JSON logic definition" };
    }
    try {
      await this.agentLogic.set(tenantId, item.agent, item.target, parsed, AUTO_APPLY_ACTOR);
      this.logger.log(
        `LogicApplierService.applyLogicUpdate(${tenantId}): AUTO-APPLIED ${item.agent}/${item.target} (${parsed.length} rule(s)) — no human approval, see this class's own doc.`,
      );
      return { applied: true };
    } catch (caught) {
      this.logger.warn(
        `LogicApplierService.applyLogicUpdate(${tenantId}): write to agent_logic failed for ${item.agent}/${item.target} — best-effort, proposal generation continues: ${String(caught)}`,
      );
      return { applied: false, reason: `write failed: ${String(caught)}` };
    }
  }
}
