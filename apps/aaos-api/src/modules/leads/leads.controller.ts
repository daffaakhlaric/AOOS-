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
  GetLeadsAnalyticsQuerySchema,
  type GetLeadsAnalyticsQueryDto,
  type LeadsAnalyticsResponseDto,
} from "./dto/analytics.dto.js";
import { ClaimLeadBodySchema, type ClaimLeadBodyDto } from "./dto/claim-lead.dto.js";
import { CreateLeadBodySchema, type CreateLeadBodyDto } from "./dto/create-lead.dto.js";
import { GetLeadsQuerySchema, type GetLeadsQueryDto } from "./dto/get-leads.dto.js";
import { GetMessagesQuerySchema, type GetMessagesQueryDto } from "./dto/get-messages.dto.js";
import { GetMyLeadsQuerySchema, type GetMyLeadsQueryDto } from "./dto/get-my-leads.dto.js";
import { InterveneBodySchema, type InterveneBodyDto } from "./dto/intervene.dto.js";
import type { LeadDetailResponseDto, MessageResponseDto } from "./dto/lead-detail-response.dto.js";
import type { LeadResponseDto } from "./dto/lead-response.dto.js";
import type { MessagesPageResponseDto } from "./dto/messages-page-response.dto.js";
import type { ScoringEventResponseDto } from "./dto/scoring-history-response.dto.js";
import { SendMessageBodySchema, type SendMessageBodyDto } from "./dto/send-message.dto.js";
import {
  UpdateLeadStatusBodySchema,
  type UpdateLeadStatusBodyDto,
} from "./dto/update-lead-status.dto.js";
import { LeadsService } from "./leads.service.js";

/**
 * `POST/GET /api/v1/leads*` — all require `x-api-key` auth (mirrors `MetaAdsController`'s auth
 * discipline). AAOS-W4B adds `POST :id/claim`, `PUT :id/status`, `GET my`, `GET :id` for
 * `apps/aaos-crm`. `my` is registered BEFORE `:id` so Nest's route matching doesn't treat the
 * literal path segment `"my"` as a `:id` param.
 */
@Controller("api/v1/leads")
@UseGuards(ApiKeyGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @HttpCode(201)
  async createLead(
    @Body(new ZodValidationPipe(CreateLeadBodySchema)) body: CreateLeadBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<LeadResponseDto> {
    return this.leadsService.createLead(body, correlationId);
  }

  @Get()
  async getLeads(
    @Query(new ZodValidationPipe(GetLeadsQuerySchema)) query: GetLeadsQueryDto,
  ): Promise<readonly LeadResponseDto[]> {
    return this.leadsService.getLeadsByBranch(query);
  }

  @Get("my")
  async getMyLeads(
    @Query(new ZodValidationPipe(GetMyLeadsQuerySchema)) query: GetMyLeadsQueryDto,
  ): Promise<readonly LeadResponseDto[]> {
    return this.leadsService.getMyLeads(query);
  }

  /** `GET /api/v1/leads/analytics?days=` — real `/clara/analytics` KPIs (MENU RESTRUCTURE FINAL). Registered before `:id` so the literal path segment `"analytics"` is never swallowed by `:id`, same reasoning as `"my"` above. */
  @Get("analytics")
  async getAnalytics(
    @Query(new ZodValidationPipe(GetLeadsAnalyticsQuerySchema)) query: GetLeadsAnalyticsQueryDto,
  ): Promise<LeadsAnalyticsResponseDto> {
    return this.leadsService.getAnalytics(query);
  }

  @Get(":id")
  async getLeadDetail(@Param("id") id: string): Promise<LeadDetailResponseDto> {
    return this.leadsService.getLeadDetail(id);
  }

  @Post(":id/claim")
  async claimLead(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ClaimLeadBodySchema)) body: ClaimLeadBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<LeadResponseDto> {
    return this.leadsService.claimLead(id, body, correlationId);
  }

  @Put(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateLeadStatusBodySchema)) body: UpdateLeadStatusBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<LeadResponseDto> {
    return this.leadsService.updateStatus(id, body, correlationId);
  }

  /** `GET /api/v1/leads/:id/messages?page=&limit=&order=` — paginated real message thread (AAOS-CHAT-ROOM-JESSY coordinator note #5). */
  @Get(":id/messages")
  async getMessages(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(GetMessagesQuerySchema)) query: GetMessagesQueryDto,
  ): Promise<MessagesPageResponseDto> {
    return this.leadsService.getMessages(id, query);
  }

  /** `POST /api/v1/leads/:id/message` — a sales human's real reply, sent via the real WhatsApp connector. */
  @Post(":id/message")
  async sendMessage(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SendMessageBodySchema)) body: SendMessageBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<MessageResponseDto> {
    return this.leadsService.sendMessage(id, body, correlationId);
  }

  /** `POST /api/v1/leads/:id/intervene` — manager-as-Clara, persisted as `sender_type = 'MANAGER_INTERVENTION'` (coordinator note #5). */
  @Post(":id/intervene")
  async intervene(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(InterveneBodySchema)) body: InterveneBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<MessageResponseDto> {
    return this.leadsService.intervene(id, body, correlationId);
  }

  /** `GET /api/v1/leads/:id/scoring-history` — thin read over the real `scoring_events` table. */
  @Get(":id/scoring-history")
  async getScoringHistory(@Param("id") id: string): Promise<readonly ScoringEventResponseDto[]> {
    return this.leadsService.getScoringHistory(id);
  }
}
