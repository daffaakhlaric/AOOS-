import { Body, Controller, Get, Inject, Param, Put, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../di-tokens.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { BranchesService } from "./branches.service.js";
import type { BranchResponseDto } from "./dto/branch-response.dto.js";
import { UpdateBranchBodySchema, type UpdateBranchBodyDto } from "./dto/update-branch.dto.js";

/** `GET/PUT /api/v1/branches*` — `x-api-key` auth (mirrors `LeadsController`/`MetaAdsController`'s auth discipline). */
@Controller("api/v1/branches")
@UseGuards(ApiKeyGuard)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
  ) {}

  @Get()
  listBranches(): readonly BranchResponseDto[] {
    return this.branchesService.listBranches();
  }

  @Put(":id")
  async updateBranch(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateBranchBodySchema)) body: UpdateBranchBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<BranchResponseDto> {
    return this.branchesService.updateBranch(id, body, this.config.AAOS_TENANT_ID, correlationId);
  }
}
