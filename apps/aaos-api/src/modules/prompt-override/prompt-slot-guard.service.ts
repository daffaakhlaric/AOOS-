import { Injectable, Logger } from "@nestjs/common";

import { PromptOverrideRepository } from "./infrastructure/prompt-override.repository.js";

/**
 * `PromptSlotGuardService` (AAOS Self-Improving, real production incident fix — see this file's own
 * commit message for the full incident writeup) — a structural, ADDITIVE safety net for EVERY
 * `PROMPT_UPDATE` auto-apply (`LearningService.persistProposal`), the same class of safeguard
 * `ConfigApplierService`'s magnitude-bounds check (Phase SI-5) and `SandboxService`'s honest
 * negative-signal block (Phase SI-4/SI-5) already establish for `CONFIG_UPDATE`/`PROMPT_UPDATE`
 * respectively — NOT a human-approval gate (the user's own standing "full auto-apply, no human gate"
 * decision is unchanged; a human can still force a blocked item through
 * `LearningDecisionService.approve`, exactly as they already can for a sandbox-blocked item).
 *
 * REAL INCIDENT THIS FIXES: `SandboxService.testImprovement` is honestly scoped to ONLY
 * `SAMANTHA PROMPT_UPDATE(target="analyze")` (confirmed directly against that class's own real
 * `if (agent !== "SAMANTHA" || item.type !== "PROMPT_UPDATE" || item.target !== "analyze")` guard —
 * every OTHER agent/target combination, CLARA included, degrades to `available: false`).
 * `LearningService.persistProposal`'s own documented policy is "an ABSENT signal is never treated as
 * a reason to block, only a real negative one is" — so every CLARA `PROMPT_UPDATE` proposal sailed
 * straight through to `PromptOverrideService.applyApproved` with ZERO real gate. Confirmed live
 * against the production DB: tenant `agen-pintar-indonesia`'s `clara_system_prompt` override reached
 * version 14 within hours, its content degraded to a single generic sentence with ZERO of the real
 * `{branch}`/`{score}`/`{stage}`/`{lead_profile}`/`{available_units}`/`{stage_instruction}` slots
 * `buildSystemPrompt` (`packages/sales-agent/src/llm/buildClaraPrompt.ts`) requires — and
 * `buildSystemPrompt`'s own contract REPLACES the whole template with `promptOverride`, never
 * appends, so each one-liner completely destroyed Clara's persona, length rules, and (critically) the
 * `{available_units}` real inventory-context injection.
 *
 * WHAT THIS CLASS DOES: before ANY `PROMPT_UPDATE` item auto-applies, extracts the real `{slot}`
 * placeholders (see `extractSlots`'s own doc for the exact, honest regex) from the content the new
 * override would REPLACE — the CURRENTLY ACTIVE override row for `(tenantId, agent, promptKey)`, or,
 * if none is active yet, this prompt key's real BASE TEMPLATE slot set (`BASE_TEMPLATE_SLOTS`,
 * below). If the proposed `after` content is missing ANY of those required slots, the check reports
 * `allowed: false` with the real missing/required slot lists — `LearningService.persistProposal` is
 * responsible for actually skipping the write when this happens (this class never writes anything
 * itself, same "service layer decides, this class just checks" split `ConfigApplierService`'s own
 * bounds check establishes for `CONFIG_UPDATE`).
 *
 * BASE TEMPLATE SLOT SOURCE (investigated, not assumed): `apps/aaos-api` has NO dependency on
 * `packages/sales-agent` (confirmed the same way `LearningService`'s own
 * `CLARA_PROMPT_FALLBACK_PLACEHOLDER` doc already found — no `@aos/sales-agent` entry in
 * `apps/aaos-api/package.json`), so this class cannot honestly `import` the real
 * `SYSTEM_PROMPT_TEMPLATE`/`PROPERTY_SYSTEM_PROMPT_TEMPLATE` constants from that package. Adding a
 * new cross-package dependency just to reach 2 string constants is real, additional, untested
 * surface this fix does not need. Instead, `BASE_TEMPLATE_SLOTS` is a small, explicit, DOCUMENTED
 * real mapping maintained here, hand-verified against the real, current template source
 * (`packages/sales-agent/src/llm/buildClaraPrompt.ts`'s `SYSTEM_PROMPT_TEMPLATE` and
 * `buildClaraPropertyPrompt.ts`'s `PROPERTY_SYSTEM_PROMPT_TEMPLATE`, both read directly before this
 * file was written) — the more honest of the two real options this task asked to weigh, given the
 * cross-package import is not clean. Every OTHER real `KNOWN_PROMPT_KEYS` value (`analyze`,
 * `creative_brief`, `campaign_strategy`, `select_targeting`, `resolve_location`, `asset_insight`,
 * `chat`, `generate_caption`, `generate_hashtags`, `generate_improvement_plan`,
 * `generate_daily_insight`, `self_analyze_gap`) is confirmed, by direct grep of every
 * `promptOverride.resolve(...)` call site in `LlmService`, to NEVER go through a `.replace("{slot}",
 * ...)` substitution pass at all — those prompts are used as verbatim system-prompt content, so they
 * have NO real slot contract to protect. Mapping them to an empty slot list is the honest reflection
 * of that finding, not a gap in coverage: this guard NEVER blocks a `PROMPT_UPDATE` for one of those
 * keys (nothing real to lose), and DOES protect `clara_system_prompt`/`clara_property_system_prompt`
 * — the exact 2 real, currently-live keys with a genuine slot-substitution contract, and the exact 2
 * this real incident concerns (AUTOMOTIVE already corrupted; PROPERTY exposed to the identical risk
 * once real PROPERTY closings flow through the live-run judge pipeline, per this task's own brief).
 *
 * If a prompt key's base template is ever extended with a NEW real `{slot}`, or a new prompt key
 * gains a real slot-substitution contract, `BASE_TEMPLATE_SLOTS` (and this doc) MUST be updated in
 * the same change — same "any future column MUST be added in both files" discipline this codebase's
 * repository row-shape docs already establish elsewhere.
 */
const BASE_TEMPLATE_SLOTS: Readonly<Record<string, readonly string[]>> = {
  // `buildClaraPrompt.ts`'s `SYSTEM_PROMPT_TEMPLATE` + `buildSystemPrompt`'s own real `.replace(...)`
  // chain — 6 real slots, verified by direct read.
  clara_system_prompt: [
    "branch",
    "score",
    "stage",
    "lead_profile",
    "available_units",
    "stage_instruction",
  ],
  // `buildClaraPropertyPrompt.ts`'s `PROPERTY_SYSTEM_PROMPT_TEMPLATE` + `buildPropertySystemPrompt`'s
  // own real `.replace(...)` chain — 8 real slots, verified by direct read. Deliberately does NOT
  // include `{branch}`/`{lead_profile}` (that file's own top-level doc explains why PROPERTY has
  // neither slot at all).
  clara_property_system_prompt: [
    "score",
    "stage",
    "detected_intents",
    "matched_listings",
    "requested_property_type",
    "alternative_city",
    "sales_name",
    "stage_instruction",
  ],
};

/**
 * Real, honest slot-naming convention used verbatim by BOTH `buildClaraPrompt.ts`/
 * `buildClaraPropertyPrompt.ts` (`{branch}`, `{lead_profile}`, `{stage_instruction}`, etc. — every
 * real slot name is lowercase ASCII letters and underscores only, confirmed by direct read of every
 * `{...}` placeholder in both real templates). Deliberately NOT a looser pattern (e.g. allowing
 * digits or mixed case) — a looser regex risks matching literal `{...}` text that happens to appear
 * in a prompt's own prose (Indonesian sales copy) as a false "slot", which this check must never do
 * (a false-positive "required slot" would incorrectly block an honest, well-formed proposal).
 */
const SLOT_PATTERN = /\{([a-z_]+)\}/g;

/**
 * Every distinct real slot NAME (bare, WITHOUT the surrounding `{`/`}` — e.g. `"branch"`, not
 * `"{branch}"`) appearing in `content`, in first-seen order — never fabricated, never inferred from
 * anything but the real literal text. Bare names are the one consistent shape `check()` below
 * compares against `BASE_TEMPLATE_SLOTS`'s own bare-name entries, whether the required-slot list
 * came from a currently active override's own content (also run through this same function) or from
 * `BASE_TEMPLATE_SLOTS` directly — keeping both sides of every comparison in this file in the exact
 * same bare-name shape (display code re-adds the braces only when rendering a human-readable
 * message).
 */
export function extractSlots(content: string): readonly string[] {
  const names: string[] = [];
  for (const match of content.matchAll(SLOT_PATTERN)) {
    const name = match[1];
    if (name !== undefined) {
      names.push(name);
    }
  }
  return [...new Set(names)];
}

export interface PromptSlotGuardResult {
  readonly allowed: boolean;
  /** The real slot set this check required `after` to preserve — either the currently active override's own real slots, or (no active override yet) this prompt key's real base-template slots. Empty when this prompt key has no known slot contract (see this file's own class doc). */
  readonly requiredSlots: readonly string[];
  /** The real slots `requiredSlots` has that `after` is missing — always `[]` when `allowed` is `true`. */
  readonly missingSlots: readonly string[];
  /** Human-readable, honest explanation — always populated, never blank, regardless of `allowed`. */
  readonly reason: string;
}

@Injectable()
export class PromptSlotGuardService {
  private readonly logger = new Logger(PromptSlotGuardService.name);

  constructor(private readonly repository: PromptOverrideRepository) {}

  /**
   * `agent`/`promptKey` — the exact `(tenantId, agent, promptKey)` an `agent_prompt_overrides` write
   * would target. `after` — the proposed new content (`ImprovementItem.after`). Never throws: a real
   * repository read failure fails OPEN to `allowed: true` with `requiredSlots: []` and an honest
   * `reason` — same "never turn a transient config-table read failure into blocking every real
   * auto-apply" discipline `PromptOverrideService.resolve` already establishes for its own read path;
   * a slot-integrity check is a real, additional safety net, not a new single point of failure that
   * could itself freeze every future auto-apply if the DB hiccups.
   */
  async check(
    tenantId: string,
    agent: string,
    promptKey: string,
    after: string,
  ): Promise<PromptSlotGuardResult> {
    let requiredSlots: readonly string[];
    try {
      const active = await this.repository.findActive(tenantId, agent, promptKey);
      requiredSlots =
        active !== undefined
          ? extractSlots(active.content)
          : (BASE_TEMPLATE_SLOTS[promptKey] ?? []);
    } catch (caught) {
      this.logger.warn(
        `PromptSlotGuardService.check(${tenantId}, ${agent}, ${promptKey}): failed to read the current active override — failing OPEN (never blocking auto-apply on a transient read failure): ${String(caught)}`,
      );
      return {
        allowed: true,
        requiredSlots: [],
        missingSlots: [],
        reason: `Could not read the current active override (${String(caught)}) — check skipped, not blocking.`,
      };
    }

    if (requiredSlots.length === 0) {
      return {
        allowed: true,
        requiredSlots: [],
        missingSlots: [],
        reason: `Prompt key "${promptKey}" has no known real {slot} contract (no active override to preserve, and no base-template slots are documented for it) — nothing to check.`,
      };
    }

    const proposedSlots = new Set(extractSlots(after));
    const missingSlots = requiredSlots.filter((slot) => !proposedSlots.has(slot));

    if (missingSlots.length > 0) {
      return {
        allowed: false,
        requiredSlots,
        missingSlots,
        reason: `Proposed content for ${agent}/${promptKey} is missing ${String(missingSlots.length)} required slot(s): ${missingSlots.map((s) => `{${s}}`).join(", ")}. The current content/base template requires: ${requiredSlots.map((s) => `{${s}}`).join(", ")}.`,
      };
    }

    return {
      allowed: true,
      requiredSlots,
      missingSlots: [],
      reason: `Proposed content for ${agent}/${promptKey} preserves every required slot (${requiredSlots.map((s) => `{${s}}`).join(", ")}).`,
    };
  }
}
