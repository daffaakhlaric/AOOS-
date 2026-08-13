import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  CreateObjectiveBodySchema,
  type CreateObjectiveBodyDto,
} from "./dto/create-objective.dto.js";
import type { ObjectiveResponseDto } from "./dto/objective-response.dto.js";
import { ObjectiveService } from "./objective.service.js";

/** `GET/POST /api/v1/objective` — `x-api-key` auth (mirrors `LeadsController`/`MetaAdsController`'s auth discipline). */
@Controller("api/v1/objective")
@UseGuards(ApiKeyGuard)
export class ObjectiveController {
  constructor(private readonly objectiveService: ObjectiveService) {}

  @Get()
  getCurrentObjective(): ObjectiveResponseDto {
    return this.objectiveService.getCurrentObjective();
  }

  @Post()
  @HttpCode(201)
  async createObjective(
    @Body(new ZodValidationPipe(CreateObjectiveBodySchema)) body: CreateObjectiveBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<ObjectiveResponseDto> {
    return this.objectiveService.createObjective(body, correlationId);
  }
}
