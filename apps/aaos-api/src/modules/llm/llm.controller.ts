import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

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
import { LlmService } from "./llm.service.js";

/**
 * `POST /api/v1/llm/{analyze,creative-brief,chat}` — Samantha's OpenAI-backed endpoints. All
 * `x-api-key`-guarded via the same `ApiKeyGuard` `modules/meta-ads` uses (this app has one shared
 * secret, not per-user tokens). Every response is `HttpCode(200)` even for the "AI unavailable"
 * fallback case — spec Section 7 requires a distinguishable response body the dashboard can branch
 * on, not an HTTP error status, so a degraded-but-handled AI response is still a successful HTTP
 * request.
 */
@Controller("api/v1/llm")
@UseGuards(ApiKeyGuard)
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post("analyze")
  @HttpCode(200)
  async analyze(
    @Body(new ZodValidationPipe(AnalyzeRequestSchema)) body: AnalyzeRequestDto,
  ): Promise<AnalyzeResponseDto> {
    return this.llmService.analyze(body);
  }

  @Post("creative-brief")
  @HttpCode(200)
  async creativeBrief(
    @Body(new ZodValidationPipe(CreativeBriefRequestSchema)) body: CreativeBriefRequestDto,
  ): Promise<CreativeBriefResponseDto> {
    return this.llmService.creativeBrief(body);
  }

  @Post("chat")
  @HttpCode(200)
  async chat(
    @Body(new ZodValidationPipe(ChatRequestSchema)) body: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    return this.llmService.chat(body);
  }
}
