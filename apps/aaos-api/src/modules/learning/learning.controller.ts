import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { DecideProposalBodySchema, type DecideProposalBodyDto } from "./dto/decide-proposal.dto.js";
import {
  toLearningProposalResponseDto,
  type LearningProposalResponseDto,
} from "./dto/learning-proposal-response.dto.js";
import {
  toPromptOverrideResponseDto,
  type PromptOverrideResponseDto,
} from "./dto/prompt-override-response.dto.js";
import { LearningDecisionService } from "./learning-decision.service.js";

/**
 * `api/v1/learning*` (AAOS Self-Learning AI, Phase C — the human-approval gate). `x-api-key`
 * auth via `ApiKeyGuard`, the SAME auth convention every other manager-facing controller in this
 * app already uses (`GoLiveController`/`SimulationController`/`ActivityLogController` — verified
 * directly, not guessed; this app has no separate JWT/session guard on its own HTTP layer, only
 * Supabase RLS on the tenant's direct-read policies, e.g. `022_agent_prompt_overrides.sql`'s
 * `manager_view_own_tenant_prompt_overrides`).
 *
 * `proposals` is tenant-scoped via `@TenantId()` (`common/tenant-context.ts`, the same decorator
 * `SimulationController.start`/`ActivityLogController.list` already use) for the LIST endpoint;
 * the `:id`-scoped routes (get/approve/reject) look up the proposal directly by id and always act
 * on ITS OWN real `tenant_id` column for any downstream write — never the caller's request-header
 * tenant id — so there is no cross-tenant write risk even without an extra tenant check on those
 * routes (same "an `:id` lookup doesn't re-check the caller's tenant" precedent
 * `SimulationController`'s own `:id/approve`/`:id/reject` already establishes).
 */
@Controller("api/v1/learning")
@UseGuards(ApiKeyGuard)
export class LearningController {
  constructor(private readonly decisions: LearningDecisionService) {}

  @Get("proposals")
  async listProposals(
    @TenantId() tenantId: string,
    @Query("status") status?: string,
  ): Promise<readonly LearningProposalResponseDto[]> {
    const rows = await this.decisions.listProposals(tenantId, status);
    return rows.map(toLearningProposalResponseDto);
  }

  @Get("proposals/:id")
  async getProposal(@Param("id") id: string): Promise<LearningProposalResponseDto> {
    const row = await this.decisions.getProposal(id);
    return toLearningProposalResponseDto(row);
  }

  @Post("proposals/:id/approve")
  @HttpCode(200)
  async approve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(DecideProposalBodySchema)) body: DecideProposalBodyDto,
  ): Promise<LearningProposalResponseDto> {
    const row = await this.decisions.approve(id, body.decidedBy, body.decisionNotes);
    return toLearningProposalResponseDto(row);
  }

  @Post("proposals/:id/reject")
  @HttpCode(200)
  async reject(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(DecideProposalBodySchema)) body: DecideProposalBodyDto,
  ): Promise<LearningProposalResponseDto> {
    const row = await this.decisions.reject(id, body.decidedBy, body.decisionNotes);
    return toLearningProposalResponseDto(row);
  }

  /** The Learning Monitor's real "what's live right now" table source. */
  @Get("prompt-overrides/:tenantId/active")
  async listActiveOverrides(
    @Param("tenantId") tenantId: string,
  ): Promise<readonly PromptOverrideResponseDto[]> {
    const rows = await this.decisions.listActiveOverrides(tenantId);
    return rows.map(toPromptOverrideResponseDto);
  }

  /** Real, manual, auditable rollback (design doc Finding #6) — never an automatic score-triggered one. */
  @Post("prompt-overrides/:tenantId/:agent/:promptKey/rollback")
  @HttpCode(200)
  async rollback(
    @Param("tenantId") tenantId: string,
    @Param("agent") agent: string,
    @Param("promptKey") promptKey: string,
  ): Promise<{ readonly rolledBackToVersion: number | null }> {
    return this.decisions.rollback(tenantId, agent, promptKey);
  }
}
