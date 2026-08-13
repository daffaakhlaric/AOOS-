import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ClosingsService } from "./closings.service.js";
import type { ClosingResponseDto } from "./dto/closing-response.dto.js";
import { CreateClosingBodySchema, type CreateClosingBodyDto } from "./dto/create-closing.dto.js";
import { GetClosingsQuerySchema, type GetClosingsQueryDto } from "./dto/get-closings.dto.js";

/** `POST/GET /api/v1/closings` — `x-api-key` auth (mirrors `LeadsController`'s auth discipline). */
@Controller("api/v1/closings")
@UseGuards(ApiKeyGuard)
export class ClosingsController {
  constructor(private readonly closingsService: ClosingsService) {}

  @Post()
  @HttpCode(201)
  async createClosing(
    @Body(new ZodValidationPipe(CreateClosingBodySchema)) body: CreateClosingBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<ClosingResponseDto> {
    return this.closingsService.createClosing(body, correlationId);
  }

  @Get()
  async getClosings(
    @Query(new ZodValidationPipe(GetClosingsQuerySchema)) query: GetClosingsQueryDto,
  ): Promise<readonly ClosingResponseDto[]> {
    return this.closingsService.getClosings(query);
  }
}
