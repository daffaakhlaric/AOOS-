import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  SetAutoModeBodySchema,
  type AutoModeResponseDto,
  type SetAutoModeBodyDto,
} from "./dto/auto-mode.dto.js";
import {
  BroadcastToLeadBodySchema,
  type BroadcastAllResultDto,
  type BroadcastResultDto,
  type BroadcastToLeadBodyDto,
} from "./dto/broadcast.dto.js";
import {
  GetLogsQuerySchema,
  toBroadcastLogResponseDto,
  type BroadcastLogResponseDto,
  type GetLogsQueryDto,
} from "./dto/logs.dto.js";
import {
  toRecyclingPoolLeadResponseDto,
  type RecyclingPoolLeadResponseDto,
} from "./dto/pool-lead-response.dto.js";
import {
  CreateTemplateBodySchema,
  UpdateTemplateBodySchema,
  toTemplateResponseDto,
  type CreateTemplateBodyDto,
  type TemplateResponseDto,
  type UpdateTemplateBodyDto,
} from "./dto/template.dto.js";
import { RecyclingService } from "./recycling.service.js";

/**
 * `/api/v1/recycling*` — `x-api-key` auth, same discipline as every other write endpoint in this
 * app (AAOS-LEAD-RECYCLING-BROADCAST). Backs `/clara/recycling`'s 3 tabs.
 */
@Controller("api/v1/recycling")
@UseGuards(ApiKeyGuard)
export class RecyclingController {
  constructor(private readonly service: RecyclingService) {}

  /** TAB 1 — every lead currently in the recycling pool, each flagged whether it's ready to send right now. */
  @Get("pool")
  async getPool(): Promise<readonly RecyclingPoolLeadResponseDto[]> {
    const leads = await this.service.getPool();
    return leads.map((lead) =>
      toRecyclingPoolLeadResponseDto(lead, this.service.isReadyToSendNow(lead)),
    );
  }

  /** TAB 2 — active/draft/inactive templates for this tenant. */
  @Get("templates")
  async listTemplates(): Promise<readonly TemplateResponseDto[]> {
    const rows = await this.service.listTemplates();
    return rows.map(toTemplateResponseDto);
  }

  @Post("templates")
  @HttpCode(201)
  async createTemplate(
    @Body(new ZodValidationPipe(CreateTemplateBodySchema)) body: CreateTemplateBodyDto,
  ): Promise<TemplateResponseDto> {
    const row = await this.service.createTemplate(body);
    return toTemplateResponseDto(row);
  }

  @Put("templates/:id")
  async updateTemplate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateTemplateBodySchema)) body: UpdateTemplateBodyDto,
  ): Promise<TemplateResponseDto> {
    const row = await this.service.updateTemplate(id, body);
    return toTemplateResponseDto(row);
  }

  /** TAB 1's "Kirim ▶" modal's "Kirim Sekarang" — manual, single lead, explicit template. */
  @Post("broadcast/:leadId")
  @HttpCode(200)
  async broadcastToLead(
    @Param("leadId") leadId: string,
    @Body(new ZodValidationPipe(BroadcastToLeadBodySchema)) body: BroadcastToLeadBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<BroadcastResultDto> {
    return this.service.broadcastToLead(leadId, body.templateId, correlationId);
  }

  /** TAB 1's "Broadcast ke Semua yang Siap" primary button. */
  @Post("broadcast-all")
  @HttpCode(200)
  async broadcastAll(@CorrelationId() correlationId: string): Promise<BroadcastAllResultDto> {
    return this.service.broadcastAll(correlationId);
  }

  /** TAB 3 — Riwayat Broadcast. */
  @Get("logs")
  async getLogs(
    @Query(new ZodValidationPipe(GetLogsQuerySchema)) query: GetLogsQueryDto,
  ): Promise<readonly BroadcastLogResponseDto[]> {
    const rows = await this.service.getLogs(query.limit);
    return rows.map(toBroadcastLogResponseDto);
  }

  /** The page header's "Toggle Auto Mode" switch (coordinator note section 8). */
  @Get("auto-mode")
  async getAutoMode(): Promise<AutoModeResponseDto> {
    return { autoMode: await this.service.getAutoMode() };
  }

  @Post("auto-mode")
  @HttpCode(200)
  async setAutoMode(
    @Body(new ZodValidationPipe(SetAutoModeBodySchema)) body: SetAutoModeBodyDto,
  ): Promise<AutoModeResponseDto> {
    await this.service.setAutoMode(body.autoMode);
    return { autoMode: body.autoMode };
  }
}
