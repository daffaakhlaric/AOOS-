import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthenticatedUserId, TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  DecidePendingActionBodySchema,
  type DecidePendingActionBodyDto,
} from "./dto/decide-pending-action.dto.js";
import {
  toPendingActionResponseDto,
  type PendingActionResponseDto,
} from "./dto/pending-action-response.dto.js";
import { PendingActionsService } from "./pending-actions.service.js";

/**
 * `api/v1/pending-actions*` (AAOS-OPERATING-MODE-APPROVAL-GATE) — the human-approval gate's real
 * HTTP surface, mirroring `LearningController`'s exact real composition (the closest-in-shape
 * precedent). `x-api-key` auth via `ApiKeyGuard`, the SAME auth convention every other
 * manager-facing controller in this app already uses.
 *
 * Every route here is `@TenantId()`-scoped from day one (`common/tenant-context.ts`, the same
 * decorator `LearningController.listProposals`/`SettingsController` already use) — including the
 * `:id`-scoped approve/reject routes, which additionally verify row ownership inside
 * `PendingActionsService` (see that class's own doc for why this deliberately goes further than
 * `LearningController`'s own `:id`-scoped routes).
 */
@Controller("api/v1/pending-actions")
@UseGuards(ApiKeyGuard)
export class PendingActionsController {
  constructor(private readonly service: PendingActionsService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query("status") status?: string,
  ): Promise<readonly PendingActionResponseDto[]> {
    const rows = await this.service.listPending(tenantId, status);
    return rows.map(toPendingActionResponseDto);
  }

  @Post(":id/approve")
  @HttpCode(200)
  async approve(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(DecidePendingActionBodySchema)) body: DecidePendingActionBodyDto,
    @AuthenticatedUserId() actorId: string,
  ): Promise<PendingActionResponseDto> {
    const row = await this.service.approve(id, tenantId, actorId, body.decisionNotes);
    return toPendingActionResponseDto(row);
  }

  @Post(":id/reject")
  @HttpCode(200)
  async reject(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(DecidePendingActionBodySchema)) body: DecidePendingActionBodyDto,
    @AuthenticatedUserId() actorId: string,
  ): Promise<PendingActionResponseDto> {
    const row = await this.service.reject(id, tenantId, actorId, body.decisionNotes);
    return toPendingActionResponseDto(row);
  }
}
