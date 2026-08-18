import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativePackagesService } from "./creative-packages.service.js";
import {
  CreatePackageBodySchema,
  GetLogsQuerySchema,
  GetPackagesQuerySchema,
  type CreatePackageBodyDto,
  type GetLogsQueryDto,
  type GetPackagesQueryDto,
} from "./dto/create-package.dto.js";
import type {
  CreativeLogResponseDto,
  CreativePackageDetailResponseDto,
  CreativePackageResponseDto,
} from "./dto/creative-package-response.dto.js";
import {
  ApprovePackageBodySchema,
  RejectPackageBodySchema,
  type ApprovePackageBodyDto,
  type RejectPackageBodyDto,
} from "./dto/review-package.dto.js";

/**
 * `GET/POST /api/v1/creative-packages*` — `x-api-key` auth (mirrors `LeadsController`/
 * `ScraperController`'s auth discipline).
 *
 * Route order matters for Nest's matcher: the literal `logs` segment is declared BEFORE `:id`, so
 * `GET .../logs` is never swallowed as a package lookup with `id === "logs"`.
 *
 * NOTE ON THE ABSENT ENDPOINTS: there is deliberately no `POST /api/v1/creative/settings` and no
 * scheduled trigger anywhere in this module. Kie AI generation is reachable ONLY through
 * `POST :id/generate` (or `POST /` with `generate: true`), i.e. only from a human clicking on a
 * specific brief.
 */
@Controller("api/v1/creative-packages")
@UseGuards(ApiKeyGuard)
export class CreativePackagesController {
  constructor(private readonly service: CreativePackagesService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(GetPackagesQuerySchema)) query: GetPackagesQueryDto,
  ): Promise<readonly CreativePackageResponseDto[]> {
    return this.service.list(query);
  }

  @Get("logs")
  async logs(
    @Query(new ZodValidationPipe(GetLogsQuerySchema)) query: GetLogsQueryDto,
  ): Promise<readonly CreativeLogResponseDto[]> {
    return this.service.logs(query);
  }

  @Get(":id")
  async byId(@Param("id") id: string): Promise<CreativePackageDetailResponseDto> {
    return this.service.byId(id);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreatePackageBodySchema)) body: CreatePackageBodyDto,
  ): Promise<CreativePackageResponseDto> {
    return this.service.create(body);
  }

  /** 202: the real Kie AI pipeline runs detached; the response is the `GENERATING` row. */
  @Post(":id/generate")
  @HttpCode(202)
  async generate(@Param("id") id: string): Promise<CreativePackageResponseDto> {
    return this.service.generate(id);
  }

  @Post(":id/approve")
  @HttpCode(200)
  async approve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ApprovePackageBodySchema)) body: ApprovePackageBodyDto,
  ): Promise<CreativePackageResponseDto> {
    return this.service.approve(id, body, new Date());
  }

  @Post(":id/reject")
  @HttpCode(200)
  async reject(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectPackageBodySchema)) body: RejectPackageBodyDto,
  ): Promise<CreativePackageResponseDto> {
    return this.service.reject(id, body, new Date());
  }
}
