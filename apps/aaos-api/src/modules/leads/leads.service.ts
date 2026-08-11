import type { LeadStore } from "@aos/lead-store";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, LEAD_STORE } from "../../di-tokens.js";

import type { CreateLeadBodyDto } from "./dto/create-lead.dto.js";
import type { GetLeadsQueryDto } from "./dto/get-leads.dto.js";
import { toLeadResponseDto, type LeadResponseDto } from "./dto/lead-response.dto.js";

/**
 * Wires `CreateLead`/`GetLeadsByBranch` from `@aos/lead-store`, translating between this app's
 * HTTP DTOs and the package's domain types. Consistent error-translation pattern with
 * `modules/meta-ads/meta-ads.service.ts`: on `Result.err(...)`, this service re-throws the raw
 * `@aos/lead-store` error instance — never a Nest `HttpException` — so `AaosExceptionFilter` is
 * the single place deciding the resulting HTTP status.
 */
@Injectable()
export class LeadsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
  ) {}

  async createLead(body: CreateLeadBodyDto, correlationId: string): Promise<LeadResponseDto> {
    const result = await this.leadStore.createLead.execute({
      leadSource: body.leadSource,
      leadPhone: body.leadPhone,
      branchId: body.branchId,
      wabaPhoneNumberId: body.wabaPhoneNumberId,
      campaignId: body.campaignId,
      adId: body.adId,
      adAccountId: body.adAccountId,
      leadName: body.leadName,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }
    return toLeadResponseDto(result.value);
  }

  async getLeadsByBranch(query: GetLeadsQueryDto): Promise<readonly LeadResponseDto[]> {
    const result = await this.leadStore.getLeadsByBranch.execute(query.branchId);
    if (!result.ok) {
      throw result.error;
    }
    return result.value.map(toLeadResponseDto);
  }
}
