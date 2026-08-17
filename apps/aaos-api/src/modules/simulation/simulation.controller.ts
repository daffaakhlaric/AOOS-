import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  ReviewSimulationBodySchema,
  type ReviewSimulationBodyDto,
} from "./dto/review-simulation.dto.js";
import type {
  SimulationHistoryEntryDto,
  SimulationStatusResponseDto,
} from "./dto/simulation-status.dto.js";
import {
  StartSimulationBodySchema,
  type StartSimulationBodyDto,
  type StartSimulationResponseDto,
} from "./dto/start-simulation.dto.js";
import { SimulationService } from "./simulation.service.js";

/**
 * `POST/GET /api/v1/simulation*` — `x-api-key` auth (mirrors `ClosingsController`/
 * `CreativePackagesController`'s auth discipline). Route order matters for Nest's matcher:
 * `history` is registered before `:id/status` so `GET /api/v1/simulation/history` is never
 * swallowed by a `:id`-shaped route (Nest matches path segments literally, so `history` here isn't
 * actually ambiguous with `:id/status` — both have a fixed 2nd segment — but the sibling literal
 * route is still declared first per this codebase's existing convention).
 */
@Controller("api/v1/simulation")
@UseGuards(ApiKeyGuard)
export class SimulationController {
  constructor(private readonly service: SimulationService) {}

  @Get("history")
  async history(): Promise<readonly SimulationHistoryEntryDto[]> {
    return this.service.history();
  }

  @Post("start")
  @HttpCode(202)
  async start(
    @Body(new ZodValidationPipe(StartSimulationBodySchema)) body: StartSimulationBodyDto,
  ): Promise<StartSimulationResponseDto> {
    return this.service.start(body);
  }

  @Get(":id/status")
  async status(@Param("id") id: string): Promise<SimulationStatusResponseDto> {
    return this.service.getStatus(id);
  }

  @Post(":id/approve")
  @HttpCode(200)
  async approve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ReviewSimulationBodySchema)) body: ReviewSimulationBodyDto,
  ): Promise<SimulationStatusResponseDto> {
    return this.service.approve(id, body);
  }

  @Post(":id/reject")
  @HttpCode(200)
  async reject(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ReviewSimulationBodySchema)) body: ReviewSimulationBodyDto,
  ): Promise<SimulationStatusResponseDto> {
    return this.service.reject(id, body);
  }
}
