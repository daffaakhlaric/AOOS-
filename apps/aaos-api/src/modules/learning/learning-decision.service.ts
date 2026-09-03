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
 * AAOS Self-Learning AI, Phase C — the human-approval gate. HARD RULE, confirmed explicitly by the
 * user: an AI-generated improvement must NEVER apply to production without an explicit human
 * Approve action. This class (via `PromptOverrideService.applyApproved`/`.rollback`) is the ONLY
 * place anywhere in this whole three-phase effort that ever writes an ACTIVE
 * `agent_prompt_overrides` row — and `approve()` is the ONLY method that ever calls
 * `applyApproved`. `LearningService` (Phase B, a separate class in this same module) only ever
 * generates a PENDING proposal; it is never touched here, and this class never generates one — it
 * only decides on one that already exists.
 *
 * `reject()` is a real, deliberate no-op against `agent_prompt_overrides` — it writes ONLY to
 * `learning_proposals` (status/decided_by/decision_notes/decided_at), matching the design doc's
 * own "Reject writes ... changes nothing else" framing exactly.
 *
 * Both `approve()` and `reject()` guard on `status === 'PENDING'` before doing anything, throwing
 * a real `ConflictError` (409, `AaosExceptionFilter`'s existing mapping) for an already-decided
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
   * UPDATED, AAOS Self-Improving Phase SI-1: a real `CONFIG_UPDATE` item is no longer inert — but
   * it is auto-applied to `agent_configs` at PROPOSAL-PERSIST time
   * (`LearningService.persistProposal` -> `ConfigApplierService.applyConfigUpdate`, immediately,
   * with NO human approval step — the user's own explicit, twice-confirmed decision, see that
   * class's own doc), never here at Approve time. By the time a human reaches this method, any
   * `CONFIG_UPDATE` item on the proposal has already been applied (or already failed, best-effort)
   * — re-applying it here would be a real, dishonest double-write, so this branch stays a
   * deliberate no-op for `CONFIG_UPDATE`, now for a DIFFERENT real reason than Phase B's original
   * "no real config_key vocabulary exists yet" finding (which is now false for exactly the 2 real
   * `KNOWN_CONFIG_KEYS`).
   *
   * If any `applyApproved` call throws, the error propagates uncaught and `learning_proposals` is
   * NEVER marked `APPROVED` — a proposal whose write failed stays `PENDING`, honestly reflecting
   * that the approval did not fully take effect (never a partial "APPROVED" status hiding a failed
   * write). Any improvement(s) that DID succeed before the failure remain applied — this method
   * does not attempt cross-improvement atomicity (no transaction precedent exists in this
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
    if (proposal.status !== "PENDING") {
      throw new ConflictError(
        `learning_proposals "${id}" has status "${proposal.status}" — only a PENDING proposal can be approved`,
      );
    }

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
          `LearningDecisionService.approve(${id}): improvement type "${item.type}" is applied elsewhere (CONFIG_UPDATE auto-applies at proposal-persist time, see LearningService.persistProposal's own doc) — no-op here, never a double-write.`,
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

  /** Real Reject write path — touches ONLY `learning_proposals`, never `agent_prompt_overrides`. */
  async reject(
    id: string,
    decidedBy: string | undefined,
    decisionNotes: string | undefined,
  ): Promise<LearningProposalRow> {
    const proposal = await this.getProposal(id);
    if (proposal.status !== "PENDING") {
      throw new ConflictError(
        `learning_proposals "${id}" has status "${proposal.status}" — only a PENDING proposal can be rejected`,
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
}
