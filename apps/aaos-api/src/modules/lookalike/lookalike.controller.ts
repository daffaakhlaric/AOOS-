import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreateLookalikeBodySchema, type CreateLookalikeBodyDto } from "./dto/lookalike.dto.js";
import {
  toMetaAudienceResponseDto,
  type LookalikeStatusResponseDto,
  type LookalikeSyncResponseDto,
  type MetaAudienceResponseDto,
} from "./dto/meta-audience-response.dto.js";
import { LookalikeService } from "./lookalike.service.js";

/**
 * `/api/v1/lookalike*` — `x-api-key` auth, same discipline as every other write endpoint in this
 * app (AAOS-ABTESTING-LOOKALIKE Part 2). Backs `/meta-ads/lookalike`'s status card + audience list
 * + "Buat Lookalike N%" buttons.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): every endpoint here
 * scopes its `LookalikeService`/repository reads and writes by tenant, so all 4 now resolve the
 * real per-request tenant via `@TenantId()` (`common/tenant-context.ts` — the same
 * `AssetsController` convention Phase T1 already established) instead of `LookalikeService`
 * reading a private `tenantId` getter aliasing the single, process-wide `AAOS_TENANT_ID` env var.
 */
@Controller("api/v1/lookalike")
@UseGuards(ApiKeyGuard)
export class LookalikeController {
  constructor(private readonly service: LookalikeService) {}

  @Get("status")
  async status(@TenantId() tenantId: string): Promise<LookalikeStatusResponseDto> {
    const status = await this.service.getStatus(tenantId);
    return {
      totalHotLeads: status.totalHotLeads,
      syncedToMetaAudience: status.syncedToMetaAudience,
      minRequiredForLookalike: status.minRequiredForLookalike,
      progressPercentage: status.progressPercentage,
      lookalikeEligible: status.lookalikeEligible,
      ...(status.lastSyncedAt !== undefined ? { lastSyncedAt: status.lastSyncedAt } : {}),
      ...(status.customAudience !== undefined
        ? { customAudience: toMetaAudienceResponseDto(status.customAudience) }
        : {}),
    };
  }

  @Get("audiences")
  async audiences(@TenantId() tenantId: string): Promise<readonly MetaAudienceResponseDto[]> {
    const audiences = await this.service.listAudiences(tenantId);
    return audiences.map(toMetaAudienceResponseDto);
  }

  @Post("sync")
  @HttpCode(200)
  async sync(@TenantId() tenantId: string): Promise<LookalikeSyncResponseDto> {
    const result = await this.service.syncHotLeadsToMeta(tenantId);
    return {
      summary: result.summary,
      newlySynced: result.newlySynced,
      totalSynced: result.totalSynced,
      ...(result.customAudience !== undefined
        ? { customAudience: toMetaAudienceResponseDto(result.customAudience) }
        : {}),
    };
  }

  @Post("audiences/lookalike")
  @HttpCode(201)
  async createLookalike(
    @Body(new ZodValidationPipe(CreateLookalikeBodySchema)) body: CreateLookalikeBodyDto,
    @TenantId() tenantId: string,
  ): Promise<MetaAudienceResponseDto> {
    const audience = await this.service.createLookalike(body.percentage, tenantId);
    return toMetaAudienceResponseDto(audience);
  }
}
