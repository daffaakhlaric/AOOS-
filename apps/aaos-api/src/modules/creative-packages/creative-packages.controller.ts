import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativePackagesService } from "./creative-packages.service.js";
import type { CreativePackageResponseDto } from "./dto/creative-package-response.dto.js";
import {
  ApprovePackageBodySchema,
  RejectPackageBodySchema,
  type ApprovePackageBodyDto,
  type RejectPackageBodyDto,
} from "./dto/review-package.dto.js";

/** `GET/POST /api/v1/creative-packages*` — `x-api-key` auth (mirrors `LeadsController`/`MetaAdsController`'s auth discipline). */
@Controller("api/v1/creative-packages")
@UseGuards(ApiKeyGuard)
export class CreativePackagesController {
  constructor(private readonly service: CreativePackagesService) {}

  @Get()
  listPending(): readonly CreativePackageResponseDto[] {
    return this.service.listPending();
  }

  @Post(":id/approve")
  @HttpCode(200)
  approve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ApprovePackageBodySchema)) body: ApprovePackageBodyDto,
  ): CreativePackageResponseDto {
    return this.service.approve(id, body, new Date());
  }

  @Post(":id/reject")
  @HttpCode(200)
  reject(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectPackageBodySchema)) body: RejectPackageBodyDto,
  ): CreativePackageResponseDto {
    return this.service.reject(id, body, new Date());
  }
}
