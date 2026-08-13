import { AssignmentMode, SalesHumanId } from "@aos/branch-manager";
import type { IMessageRepository, LeadStore } from "@aos/lead-store";
import { ConversationNotFoundError } from "@aos/lead-store";
import { ConflictException, Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, LEAD_STORE, LEAD_STORE_MESSAGE_REPOSITORY } from "../../di-tokens.js";

import type { ClaimLeadBodyDto } from "./dto/claim-lead.dto.js";
import type { CreateLeadBodyDto } from "./dto/create-lead.dto.js";
import type { GetLeadsQueryDto } from "./dto/get-leads.dto.js";
import type { GetMyLeadsQueryDto } from "./dto/get-my-leads.dto.js";
import {
  toConversationSummaryResponseDto,
  toMessageResponseDto,
  type LeadDetailResponseDto,
} from "./dto/lead-detail-response.dto.js";
import { toLeadResponseDto, type LeadResponseDto } from "./dto/lead-response.dto.js";
import type { UpdateLeadStatusBodyDto } from "./dto/update-lead-status.dto.js";

/**
 * Wires `CreateLead`/`GetLeadsByBranch` (W2E) plus the AAOS-W4B additions `RecordAssignment`
 * (claim), `UpdateLeadStatus`, `GetLeadsBySales` (my leads), and lead-detail (real conversation
 * history — coordinator note #2). Consistent error-translation pattern with
 * `modules/meta-ads/meta-ads.service.ts`: on `Result.err(...)`, this service re-throws the raw
 * `@aos/lead-store` error instance — never a Nest `HttpException` — so `AaosExceptionFilter` is
 * the single place deciding the resulting HTTP status. The one deliberate exception is `claimLead`'s
 * "already assigned" check, which throws a Nest `ConflictException` directly (409) — `RecordAssignment`
 * itself has no "already assigned" concept to re-throw (coordinator note #3).
 */
@Injectable()
export class LeadsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
    @Inject(LEAD_STORE_MESSAGE_REPOSITORY)
    private readonly messageRepository: IMessageRepository,
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

  /**
   * `POST /api/v1/leads/:id/claim` — `lead-store.RecordAssignment` with `AssignmentMode.MANUAL`
   * (coordinator note #3: no `branch-manager.UpdateSalesStatus` call). Detects "already claimed"
   * by checking the freshly-fetched `Lead.assignedSalesId` BEFORE calling `RecordAssignment`
   * (which has no such check of its own) and throws a 409 `ConflictException` — the spec's own
   * pinned test expectation.
   */
  async claimLead(
    leadId: string,
    body: ClaimLeadBodyDto,
    correlationId: string,
  ): Promise<LeadResponseDto> {
    const leadResult = await this.leadStore.getLead.execute(leadId);
    if (!leadResult.ok) {
      throw leadResult.error;
    }
    const lead = leadResult.value;
    if (lead.assignedSalesId !== undefined) {
      throw new ConflictException(
        `Lead ${leadId} is already assigned to ${lead.assignedSalesId.toString()}`,
      );
    }

    const assignResult = await this.leadStore.recordAssignment.execute({
      leadId,
      salesHumanId: body.salesHumanId,
      assignmentMode: AssignmentMode.MANUAL,
      branchId: lead.branchId,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!assignResult.ok) {
      throw assignResult.error;
    }

    const updatedLeadResult = await this.leadStore.getLead.execute(leadId);
    if (!updatedLeadResult.ok) {
      throw updatedLeadResult.error;
    }
    return toLeadResponseDto(updatedLeadResult.value);
  }

  /** `PUT /api/v1/leads/:id/status` — free `NEW | COLD | WARM | HOT` transitions only; `@aos/lead-store`'s `transitionLeadStatus` rejects `ASSIGNED`/`CLOSED` as a target. */
  async updateStatus(
    leadId: string,
    body: UpdateLeadStatusBodyDto,
    correlationId: string,
  ): Promise<LeadResponseDto> {
    const result = await this.leadStore.updateLeadStatus.execute({
      leadId,
      toStatus: body.status,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }
    return toLeadResponseDto(result.value);
  }

  /** `GET /api/v1/leads/my` — every lead currently assigned to one sales human. */
  async getMyLeads(query: GetMyLeadsQueryDto): Promise<readonly LeadResponseDto[]> {
    const idResult = SalesHumanId.create(query.salesHumanId);
    if (!idResult.ok) {
      throw idResult.error;
    }
    const result = await this.leadStore.getLeadsBySales.execute(idResult.value);
    if (!result.ok) {
      throw result.error;
    }
    return result.value.map(toLeadResponseDto);
  }

  /**
   * `GET /api/v1/leads/:id` — lead detail with the REAL conversation history (coordinator note
   * #2). A lead with no conversation yet (never exchanged a WhatsApp message) is a real, expected
   * state — `ConversationNotFoundError` is caught here and mapped to `conversation: undefined,
   * messages: []`, not re-thrown as a 404.
   */
  async getLeadDetail(leadId: string): Promise<LeadDetailResponseDto> {
    const leadResult = await this.leadStore.getLead.execute(leadId);
    if (!leadResult.ok) {
      throw leadResult.error;
    }
    const leadDto = toLeadResponseDto(leadResult.value);

    const conversationResult = await this.leadStore.getConversation.execute(leadId);
    if (!conversationResult.ok) {
      if (conversationResult.error instanceof ConversationNotFoundError) {
        return { ...leadDto, conversation: undefined, messages: [] };
      }
      throw conversationResult.error;
    }
    const conversation = conversationResult.value;

    const messagesResult = await this.messageRepository.findByConversationId(conversation.id);
    if (!messagesResult.ok) {
      throw messagesResult.error;
    }

    return {
      ...leadDto,
      conversation: toConversationSummaryResponseDto(conversation),
      messages: messagesResult.value.map(toMessageResponseDto),
    };
  }
}
