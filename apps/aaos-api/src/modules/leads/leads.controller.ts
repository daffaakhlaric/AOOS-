import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreateLeadBodySchema, type CreateLeadBodyDto } from "./dto/create-lead.dto.js";
import { GetLeadsQuerySchema, type GetLeadsQueryDto } from "./dto/get-leads.dto.js";
import type { LeadResponseDto } from "./dto/lead-response.dto.js";
import { LeadsService } from "./leads.service.js";

/** `POST /api/v1/leads`, `GET /api/v1/leads` — both require `x-api-key` auth (mirrors `MetaAdsController`'s auth discipline). */
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
}
