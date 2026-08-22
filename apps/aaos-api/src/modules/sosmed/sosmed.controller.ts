import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import {
  GenerateCaptionRequestSchema,
  type GenerateCaptionRequestDto,
  type GenerateCaptionResponseDto,
} from "../llm/dto/generate-caption.dto.js";
import {
  GenerateHashtagsRequestSchema,
  type GenerateHashtagsRequestDto,
  type GenerateHashtagsResponseDto,
} from "../llm/dto/generate-hashtags.dto.js";
import { LlmService } from "../llm/llm.service.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

/**
 * `POST /api/v1/sosmed/*` (AAOS-SOSMED-AUTOMATION Phase 1). `x-api-key`-guarded via the same
 * shared `ApiKeyGuard` every other write-capable endpoint in this app uses. Only the 2 endpoints
 * this phase builds — Content Studio's caption/hashtag generation, delegated straight to
 * `LlmService` (same shape as `LlmController`'s `/api/v1/llm/*` endpoints). Every other checklist
 * endpoint (`accounts/*`, `posts/*`, `weekly-plan`, `analytics`, `best-times/*`, the `@Cron`
 * scheduler) is a later phase, per the coordinator note's risk-ordered build plan.
 */
@Controller("api/v1/sosmed")
@UseGuards(ApiKeyGuard)
export class SosmedController {
  constructor(private readonly llmService: LlmService) {}

  @Post("generate-caption")
  @HttpCode(200)
  async generateCaption(
    @Body(new ZodValidationPipe(GenerateCaptionRequestSchema)) body: GenerateCaptionRequestDto,
  ): Promise<GenerateCaptionResponseDto> {
    return this.llmService.generateCaption(body);
  }

  @Post("generate-hashtags")
  @HttpCode(200)
  async generateHashtags(
    @Body(new ZodValidationPipe(GenerateHashtagsRequestSchema)) body: GenerateHashtagsRequestDto,
  ): Promise<GenerateHashtagsResponseDto> {
    return this.llmService.generateHashtags(body);
  }
}
