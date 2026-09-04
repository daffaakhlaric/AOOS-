import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { AgentConfigService } from "../agent-config/agent-config.service.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  SetAgentConfigBodySchema,
  toAgentConfigResponseDto,
  type AgentConfigResponseDto,
  type SetAgentConfigBodyDto,
} from "./dto/agent-config-response.dto.js";
import { DecideProposalBodySchema, type DecideProposalBodyDto } from "./dto/decide-proposal.dto.js";
import {
  toJudgeHistoryPointDto,
  type JudgeHistoryPointDto,
} from "./dto/judge-history-point.dto.js";
import {
  toLearningProposalResponseDto,
  type LearningProposalResponseDto,
} from "./dto/learning-proposal-response.dto.js";
import {
  toPromptOverrideResponseDto,
  type PromptOverrideResponseDto,
} from "./dto/prompt-override-response.dto.js";
import {
  SetPromptOverrideBodySchema,
  type SetPromptOverrideBodyDto,
} from "./dto/set-prompt-override.dto.js";
import { TriggerCheckBodySchema, type TriggerCheckBodyDto } from "./dto/trigger-check.dto.js";
import { LearningDecisionService } from "./learning-decision.service.js";
import { LearningService } from "./learning.service.js";

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
  constructor(
    private readonly decisions: LearningDecisionService,
    // AAOS Self-Improving (Phase SI-6) — real "Improve sekarang" manual trigger
    // (`LearningService.triggerManualCheck`), real Config editor (`AgentConfigService`), and real
    // Score Trend chart data (`JudgeResultRepository`, composed by `LearningModule` the same way
    // every other real repository dependency in this module already is).
    private readonly learning: LearningService,
    private readonly agentConfig: AgentConfigService,
    private readonly judgeResults: JudgeResultRepository,
  ) {}

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

  /**
   * The real, direct human/coordinator-authored prompt-override write — the Prompt editor's
   * WRITE, the sibling gap `PUT /api/v1/learning/configs` already fills for `agent_configs`. `PUT`,
   * not `POST`: idempotent "set this key to this content" semantics, matching
   * `PromptOverrideService.applyApproved`'s own real deactivate-then-insert upsert behavior. See
   * `LearningDecisionService.setOverride`'s own doc for why this is additive, not a second write
   * path.
   */
  @Put("prompt-overrides/:tenantId/:agent/:promptKey")
  async setOverride(
    @Param("tenantId") tenantId: string,
    @Param("agent") agent: string,
    @Param("promptKey") promptKey: string,
    @Body(new ZodValidationPipe(SetPromptOverrideBodySchema)) body: SetPromptOverrideBodyDto,
  ): Promise<PromptOverrideResponseDto> {
    const row = await this.decisions.setOverride(tenantId, agent, promptKey, body.content);
    return toPromptOverrideResponseDto(row);
  }

  /**
   * AAOS Self-Improving, Phase SI-6 — the Learning Monitor's real "Improve sekarang" manual-trigger
   * button. Delegates entirely to `LearningService.triggerManualCheck` (see that method's own doc
   * for exactly what real data this checks and why it never fabricates a forced proposal).
   */
  @Post("trigger")
  @HttpCode(200)
  async trigger(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(TriggerCheckBodySchema)) body: TriggerCheckBodyDto,
  ): Promise<{ readonly triggered: boolean; readonly reason?: string }> {
    return this.learning.triggerManualCheck(tenantId, body.agent);
  }

  /**
   * AAOS Self-Improving, Phase SI-6 — the Learning Monitor's real Config editor "view current
   * values" read (`AgentConfigService.listForTenant`, real `agent_configs` rows for the caller's own
   * tenant — never a client-supplied tenant id, same `@TenantId()` convention `listProposals` above
   * already establishes).
   */
  @Get("configs")
  async listConfigs(@TenantId() tenantId: string): Promise<readonly AgentConfigResponseDto[]> {
    const rows = await this.agentConfig.listForTenant(tenantId);
    return rows.map(toAgentConfigResponseDto);
  }

  /**
   * AAOS Self-Improving, Phase SI-6 — the Learning Monitor's real Config editor WRITE
   * (`AgentConfigService.set`, the SAME real upsert path `ConfigApplierService.applyConfigUpdate`'s
   * auto-apply already uses). `PUT`, not `POST`: this is a real idempotent "set this key to this
   * value" action, matching this table's own real upsert-by-`(tenantId, agent, configKey)` semantics
   * exactly.
   */
  @Put("configs")
  async setConfig(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(SetAgentConfigBodySchema)) body: SetAgentConfigBodyDto,
  ): Promise<AgentConfigResponseDto> {
    const row = await this.agentConfig.set(
      tenantId,
      body.agent,
      body.configKey,
      body.value,
      body.updatedBy,
    );
    return toAgentConfigResponseDto(row);
  }

  /**
   * AAOS Self-Improving, Phase SI-6 — the Learning Monitor's real Score Trend chart data source: the
   * caller's own tenant's real `judge_results` history for one real `agent`, over the last real
   * `days` (default 30, matching the phase's own "30-day, real judge_results history" spec),
   * oldest-first. Reuses `JudgeResultRepository.listForTenantSince` directly — the SAME real query
   * `getTodayScoreSummary`/`AccuracyCheckService` already use, never a second, parallel history
   * query. A real, honest EMPTY array (never fabricated points) for a tenant+agent with no judged
   * runs in the window yet.
   */
  @Get("judge-history")
  async judgeHistory(
    @TenantId() tenantId: string,
    @Query("agent") agent: string,
    @Query("days") daysRaw?: string,
  ): Promise<readonly JudgeHistoryPointDto[]> {
    const parsedDays = daysRaw !== undefined ? Number(daysRaw) : NaN;
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? Math.min(parsedDays, 90) : 30;
    const sinceISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const rows = await this.judgeResults.listForTenantSince(tenantId, agent, sinceISO);
    return rows.map(toJudgeHistoryPointDto);
  }
}
