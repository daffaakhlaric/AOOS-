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

import { ClaimLeadBodySchema, type ClaimLeadBodyDto } from "./dto/claim-lead.dto.js";
import { CreateLeadBodySchema, type CreateLeadBodyDto } from "./dto/create-lead.dto.js";
import { GetLeadsQuerySchema, type GetLeadsQueryDto } from "./dto/get-leads.dto.js";
import { GetMyLeadsQuerySchema, type GetMyLeadsQueryDto } from "./dto/get-my-leads.dto.js";
import type { LeadDetailResponseDto } from "./dto/lead-detail-response.dto.js";
import type { LeadResponseDto } from "./dto/lead-response.dto.js";
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
}
