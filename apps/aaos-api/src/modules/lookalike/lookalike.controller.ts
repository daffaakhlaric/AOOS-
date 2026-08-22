import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

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

/** `/api/v1/lookalike*` — `x-api-key` auth, same discipline as every other write endpoint in this app (AAOS-ABTESTING-LOOKALIKE Part 2). Backs `/meta-ads/lookalike`'s status card + audience list + "Buat Lookalike N%" buttons. */
@Controller("api/v1/lookalike")
@UseGuards(ApiKeyGuard)
export class LookalikeController {
  constructor(private readonly service: LookalikeService) {}

  @Get("status")
  async status(): Promise<LookalikeStatusResponseDto> {
    const status = await this.service.getStatus();
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
  async audiences(): Promise<readonly MetaAudienceResponseDto[]> {
    const audiences = await this.service.listAudiences();
    return audiences.map(toMetaAudienceResponseDto);
  }

  @Post("sync")
  @HttpCode(200)
  async sync(): Promise<LookalikeSyncResponseDto> {
    const result = await this.service.syncHotLeadsToMeta();
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
  ): Promise<MetaAudienceResponseDto> {
    const audience = await this.service.createLookalike(body.percentage);
    return toMetaAudienceResponseDto(audience);
  }
}
