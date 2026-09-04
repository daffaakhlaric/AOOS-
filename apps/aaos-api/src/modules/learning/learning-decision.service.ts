import { ConflictError, NotFoundError } from "@aos/errors";
import { Injectable, Logger, Optional } from "@nestjs/common";

import { ImprovementItemSchema } from "../llm/dto/improvement-plan.dto.js";
import type { PromptOverrideRow } from "../prompt-override/infrastructure/prompt-override.repository.js";
import { PromptOverrideService } from "../prompt-override/prompt-override.service.js";

import {
  LearningProposalRepository,
  type LearningProposalRow,
} from "./infrastructure/learning-proposal.repository.js";

/**
 * AAOS Self-Learning AI, Phase C — the human-approval gate. ORIGINAL HARD RULE (confirmed explicitly
 * by the user, Phase C): an AI-generated improvement must never apply to production without an
 * explicit human Approve action. AAOS Self-Improving, Phase SI-1 through SI-5 SUPERSEDED this for
 * ALL 3 improvement types, per the user's own later, explicit, TWICE-confirmed decision (see
 * `docs/PROMPT-AAOS-SELF-IMPROVING-FULL.md`'s own header) — `LearningService.persistProposal` now
 * auto-applies `CONFIG_UPDATE`/`LOGIC_UPDATE` unconditionally and `PROMPT_UPDATE` behind
 * `SandboxService`'s narrow, honest safety net. This class's `approve()` (via
 * `PromptOverrideService.applyApproved`) remains the ONLY REMAINING human-decision route — now
 * relevant specifically for a `PROMPT_UPDATE` item `persistProposal` left un-applied because
 * `SandboxService.testImprovement` returned a real negative signal for it
 * (`status = 'AUTO_APPLY_BLOCKED_BY_SANDBOX'`), or for the rare genuine-failure case a `PENDING`
 * status still represents. `approve()` is STILL the ONLY method that ever calls `applyApproved`.
 *
 * `reject()` is a real, deliberate no-op against `agent_prompt_overrides` — it writes ONLY to
 * `learning_proposals` (status/decided_by/decision_notes/decided_at), matching the design doc's
 * own "Reject writes ... changes nothing else" framing exactly.
 *
 * Both `approve()` and `reject()` guard on `status === 'PENDING' || status ===
 * 'AUTO_APPLY_BLOCKED_BY_SANDBOX'` before doing anything (Phase SI-5's real, additive widening —
 * see each method's own doc for why), throwing a real `ConflictError` (409,
 * `AaosExceptionFilter`'s existing mapping) for any OTHER already-decided/already-fully-applied
 * proposal — never a silent re-decide, per the design doc's Phase C section.
 */
@Injectable()
export class LearningDecisionService {
  private readonly logger = new Logger(LearningDecisionService.name);

  constructor(
    private readonly proposals: LearningProposalRepository,
    private readonly promptOverride: PromptOverrideService,
    // Same real bug/fix `GoLiveService`/`PromptOverrideService` document on their own
    // constructors: a bare `Function`-typed param with a default still gets a real DI resolution
    // attempt from Nest without `@Optional()`.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  async listProposals(tenantId: string, status?: string): Promise<readonly LearningProposalRow[]> {
    return this.proposals.listForTenant(tenantId, status);
  }

  async getProposal(id: string): Promise<LearningProposalRow> {
    const row = await this.proposals.findById(id);
    if (row === undefined) {
      throw new NotFoundError(`No learning_proposals row found with id "${id}"`);
    }
    return row;
  }

  /**
   * The real Approve write path. For EVERY `improvements[]` item whose real, Zod-validated
   * `type === 'PROMPT_UPDATE'`, calls `PromptOverrideService.applyApproved` — the single real
   * deactivate-then-insert write documented on that method. A `CONFIG_UPDATE` item (or any item
   * that fails re-validation against `ImprovementItemSchema`) is a real, documented no-op here,
   * never an error.
   *
   * UPDATED, AAOS Self-Improving Phase SI-1/SI-2/SI-5: a real `CONFIG_UPDATE`/`LOGIC_UPDATE` item is
   * no longer inert, and neither is a `PROMPT_UPDATE` item — all 3 are auto-applied at
   * PROPOSAL-PERSIST time (`LearningService.persistProposal`, immediately, with NO human approval
   * step — the user's own explicit, twice-confirmed decision, see that class's own doc), never here
   * at Approve time, EXCEPT a `PROMPT_UPDATE` item `SandboxService.testImprovement` honestly blocked
   * (`proposal.status === 'AUTO_APPLY_BLOCKED_BY_SANDBOX'`) — that item was deliberately left
   * un-applied by `persistProposal`, so THIS is its one real remaining apply path (a genuine human
   * override of the sandbox's narrow safety net).
   *
   * Real, honest "already applied?" check per item (Phase SI-5): a `PROMPT_UPDATE` item whose
   * `target` already appears in `proposal.auto_applied_config_keys` was ALREADY successfully
   * auto-applied by `persistProposal` — re-applying it here would be a real, dishonest double-write
   * (the exact same "no double-write" reasoning `CONFIG_UPDATE`/`LOGIC_UPDATE` items below already
   * establish), so it is skipped, logged, never re-applied. Only a `PROMPT_UPDATE` item NOT already
   * in that list — i.e. one that was genuinely never applied (sandbox-blocked, or the proposal
   * predates Phase SI-5's auto-apply) — is actually written here.
   *
   * If any `applyApproved` call throws, the error propagates uncaught and `learning_proposals` is
   * NEVER marked `APPROVED` — a proposal whose write failed stays at its current status, honestly
   * reflecting that the approval did not fully take effect (never a partial "APPROVED" status hiding
   * a failed write). Any improvement(s) that DID succeed before the failure remain applied — this
   * method does not attempt cross-improvement atomicity (no transaction precedent exists in this
   * codebase, per `PromptOverrideService.applyApproved`'s own doc); a proposal with more than one
   * improvement is a real, visible edge case worth calling out honestly rather than pretending an
   * all-or-nothing guarantee this codebase cannot actually provide.
   */
  async approve(
    id: string,
    decidedBy: string | undefined,
    decisionNotes: string | undefined,
  ): Promise<LearningProposalRow> {
    const proposal = await this.getProposal(id);
    if (proposal.status !== "PENDING" && proposal.status !== "AUTO_APPLY_BLOCKED_BY_SANDBOX") {
      throw new ConflictError(
        `learning_proposals "${id}" has status "${proposal.status}" — only a PENDING or AUTO_APPLY_BLOCKED_BY_SANDBOX proposal can be approved`,
      );
    }

    const alreadyAppliedTargets = new Set(proposal.auto_applied_config_keys);
    let appliedCount = 0;
    for (const raw of proposal.improvements) {
      const parsed = ImprovementItemSchema.safeParse(raw);
      if (!parsed.success) {
        this.logger.warn(
          `LearningDecisionService.approve(${id}): skipping a malformed improvement item (failed re-validation).`,
        );
        continue;
      }
      const item = parsed.data;
      if (item.type !== "PROMPT_UPDATE") {
        this.logger.warn(
          `LearningDecisionService.approve(${id}): improvement type "${item.type}" is applied elsewhere (CONFIG_UPDATE/LOGIC_UPDATE auto-apply at proposal-persist time, see LearningService.persistProposal's own doc) — no-op here, never a double-write.`,
        );
        continue;
      }
      if (alreadyAppliedTargets.has(item.target)) {
        this.logger.warn(
          `LearningDecisionService.approve(${id}): PROMPT_UPDATE target "${item.target}" was already auto-applied at proposal-persist time (Phase SI-5) — no-op here, never a double-write.`,
        );
        continue;
      }
      await this.promptOverride.applyApproved(
        proposal.tenant_id,
        item.agent,
        item.target,
        item.after,
      );
      appliedCount += 1;
    }

    await this.proposals.updateDecision(
      id,
      "APPROVED",
      decidedBy,
      decisionNotes,
      this.now().toISOString(),
    );
    this.logger.log(
      `LearningDecisionService.approve(${id}): applied ${appliedCount} PROMPT_UPDATE improvement(s).`,
    );
    return this.getProposal(id);
  }

  /**
   * Real Reject write path — touches ONLY `learning_proposals`, never `agent_prompt_overrides`.
   * `AUTO_APPLY_BLOCKED_BY_SANDBOX` is also decidable here (Phase SI-5, same reasoning `approve`'s
   * own doc gives) — a human rejecting a sandbox-blocked `PROMPT_UPDATE` proposal is a real,
   * meaningful decision (it stays un-applied, permanently, rather than sitting as an open item a
   * future `approve` could still act on).
   */
  async reject(
    id: string,
    decidedBy: string | undefined,
    decisionNotes: string | undefined,
  ): Promise<LearningProposalRow> {
    const proposal = await this.getProposal(id);
    if (proposal.status !== "PENDING" && proposal.status !== "AUTO_APPLY_BLOCKED_BY_SANDBOX") {
      throw new ConflictError(
        `learning_proposals "${id}" has status "${proposal.status}" — only a PENDING or AUTO_APPLY_BLOCKED_BY_SANDBOX proposal can be rejected`,
      );
    }
    await this.proposals.updateDecision(
      id,
      "REJECTED",
      decidedBy,
      decisionNotes,
      this.now().toISOString(),
    );
    return this.getProposal(id);
  }

  /** Delegates to `PromptOverrideService.rollback` — see that method's own doc for the real manual-rollback behavior (Finding #6). */
  async rollback(
    tenantId: string,
    agent: string,
    promptKey: string,
  ): Promise<{ readonly rolledBackToVersion: number | null }> {
    return this.promptOverride.rollback(tenantId, agent, promptKey);
  }

  async listActiveOverrides(tenantId: string): Promise<readonly PromptOverrideRow[]> {
    return this.promptOverride.listActiveForTenant(tenantId);
  }

  /**
   * AAOS Self-Learning AI — the real, direct human/coordinator-authored prompt-override write
   * (a real, additive capability gap: `PromptOverrideService.applyApproved` already existed, but
   * its only caller was `approve()` above, gated behind an LLM-originated, PENDING
   * `learning_proposals` row — there was no direct "set this override right now" path for a
   * human/coordinator-authored change that never went through the proposal/approve flow, unlike
   * `agent_configs`'s existing `PUT /api/v1/learning/configs` Config editor). Delegates straight to
   * `PromptOverrideService.applyApproved` — the SAME real deactivate-then-insert write every other
   * real activation path in this app already uses, never a second, parallel write path.
   */
  async setOverride(
    tenantId: string,
    agent: string,
    promptKey: string,
    content: string,
  ): Promise<PromptOverrideRow> {
    return this.promptOverride.applyApproved(tenantId, agent, promptKey, content);
  }
}
