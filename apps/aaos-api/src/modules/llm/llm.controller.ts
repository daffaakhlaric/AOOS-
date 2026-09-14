import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  AnalyzeRequestSchema,
  type AnalyzeRequestDto,
  type AnalyzeResponseDto,
} from "./dto/analyze.dto.js";
import { ChatRequestSchema, type ChatRequestDto, type ChatResponseDto } from "./dto/chat.dto.js";
import {
  CreativeBriefRequestSchema,
  type CreativeBriefRequestDto,
  type CreativeBriefResponseDto,
} from "./dto/creative-brief.dto.js";
import {
  PhotoAnalysisRequestSchema,
  type PhotoAnalysisRequestDto,
  type PhotoAnalysisResponseDto,
} from "./dto/photo-analysis.dto.js";
import { LlmService } from "./llm.service.js";

/**
 * `POST /api/v1/llm/{analyze,creative-brief,chat,photo-analysis}` — Samantha's OpenAI-backed endpoints. All
 * `x-api-key`-guarded via the same `ApiKeyGuard` `modules/meta-ads` uses (this app has one shared
 * secret, not per-user tokens). Every response is `HttpCode(200)` even for the "AI unavailable"
 * fallback case — spec Section 7 requires a distinguishable response body the dashboard can branch
 * on, not an HTTP error status, so a degraded-but-handled AI response is still a successful HTTP
 * request.
 *
 * Each handler also resolves `@TenantId()` (`common/tenant-context.ts`, the same `x-tenant-id`
 * header convention `SettingsController` establishes) and threads it into `LlmService` — AAOS
 * Self-Learning AI Phase A: lets each tenant's real active `agent_prompt_overrides` row (if any)
 * be resolved per request. Falls back to `DEFAULT_TENANT_ID` ('dss-motor') when the caller sends
 * no header, same as every other `@TenantId()`-scoped endpoint — never a hard 400.
 */
@Controller("api/v1/llm")
@UseGuards(ApiKeyGuard)
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post("analyze")
  @HttpCode(200)
  async analyze(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(AnalyzeRequestSchema)) body: AnalyzeRequestDto,
  ): Promise<AnalyzeResponseDto> {
    return this.llmService.analyze(tenantId, body);
  }

  @Post("creative-brief")
  @HttpCode(200)
  async creativeBrief(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreativeBriefRequestSchema)) body: CreativeBriefRequestDto,
  ): Promise<CreativeBriefResponseDto> {
    return this.llmService.creativeBrief(tenantId, body);
  }

  @Post("chat")
  @HttpCode(200)
  async chat(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(ChatRequestSchema)) body: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    return this.llmService.chat(tenantId, body);
  }

  /**
   * Kai Creative Engine Sprint 2 — real entry point for `LlmService.analyzePropertyPhoto`
   * (Sprint 1), reachable from the dashboard's own "Brief dari Listing" flow. Deliberately called
   * per-photo, on demand, from the frontend — NEVER wired into `SchedulerService`'s automatic
   * morning loop the way `scorePropertyAdAngleStrength` was: a Vision call has real per-photo cost
   * and latency `scorePropertyAdAngleStrength`'s pure, free scoring does not, so firing it
   * automatically on every scheduler tick (stacking on top of the Andromeda diversity-refresh check,
   * which already runs every tick) would be a real, avoidable cost regression.
   */
  @Post("photo-analysis")
  @HttpCode(200)
  async photoAnalysis(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(PhotoAnalysisRequestSchema)) body: PhotoAnalysisRequestDto,
  ): Promise<PhotoAnalysisResponseDto> {
    return this.llmService.analyzePropertyPhoto(tenantId, body);
  }
}
