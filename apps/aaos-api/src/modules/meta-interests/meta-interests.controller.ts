import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  SyncInterestsBodySchema,
  type MetaInterestResponseDto,
  type SyncInterestsBodyDto,
  type SyncInterestsResponseDto,
} from "./dto/sync-interests.dto.js";
import { MetaInterestsService } from "./meta-interests.service.js";

/**
 * `GET/POST /api/v1/meta-interests*` — `x-api-key` auth, same discipline as every other write
 * endpoint in this app (AAOS-SIMULASI-TARGETING).
 *
 * `POST /sync` makes REAL, live calls to Meta's Graph API when it runs, so it is deliberately
 * behind the guard and deliberately manual: nothing in this app schedules it. It is a read-only
 * Meta operation (interest *search*) — it can never create or change a campaign.
 *
 * Returns 200, not 201: a sync refreshes an existing catalogue in place rather than creating one
 * addressable resource, and its response body is a per-term report, not a created entity.
 */
@Controller("api/v1/meta-interests")
@UseGuards(ApiKeyGuard)
export class MetaInterestsController {
  constructor(private readonly service: MetaInterestsService) {}

  @Get()
  async list(): Promise<readonly MetaInterestResponseDto[]> {
    return this.service.list();
  }

  @Post("sync")
  @HttpCode(200)
  async sync(
    @Body(new ZodValidationPipe(SyncInterestsBodySchema)) body: SyncInterestsBodyDto,
  ): Promise<SyncInterestsResponseDto> {
    return this.service.sync(body);
  }
}
