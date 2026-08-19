import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  CreateSalesHumanBodySchema,
  type CreateSalesHumanBodyDto,
} from "./dto/create-sales-human.dto.js";
import {
  GetSalesHumansQuerySchema,
  type GetSalesHumansQueryDto,
} from "./dto/get-sales-humans-query.dto.js";
import { ResetPasswordBodySchema, type ResetPasswordBodyDto } from "./dto/reset-password.dto.js";
import type { SalesHumanAccountResponseDto } from "./dto/sales-human-account.dto.js";
import {
  UpdateSalesHumanBodySchema,
  type UpdateSalesHumanBodyDto,
} from "./dto/update-sales-human.dto.js";
import { SalesHumansService } from "./sales-humans.service.js";

/**
 * `GET/POST/PUT /api/v1/sales-humans*` — `x-api-key` auth (mirrors `SalesController`/
 * `LeadsController`'s auth discipline). Real Supabase Auth + `sales_humans` table integration per
 * coordinator note #1 — see `SalesHumansService`'s class doc for what's deliberately out of scope.
 */
@Controller("api/v1/sales-humans")
@UseGuards(ApiKeyGuard)
export class SalesHumansController {
  constructor(private readonly service: SalesHumansService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(GetSalesHumansQuerySchema)) query: GetSalesHumansQueryDto,
  ): Promise<readonly SalesHumanAccountResponseDto[]> {
    return this.service.list(query.branchId);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateSalesHumanBodySchema)) body: CreateSalesHumanBodyDto,
  ): Promise<SalesHumanAccountResponseDto> {
    return this.service.create(body);
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateSalesHumanBodySchema)) body: UpdateSalesHumanBodyDto,
  ): Promise<SalesHumanAccountResponseDto> {
    return this.service.update(id, body);
  }

  @Post(":id/reset-password")
  async resetPassword(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ResetPasswordBodySchema)) body: ResetPasswordBodyDto,
  ): Promise<SalesHumanAccountResponseDto> {
    return this.service.resetPassword(id, body.password);
  }
}
