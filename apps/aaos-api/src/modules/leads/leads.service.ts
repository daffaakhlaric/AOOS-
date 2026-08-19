import { AssignmentMode, SalesHumanId, toBranch } from "@aos/branch-manager";
import type { IMessageRepository, IScoringRepository, LeadStore } from "@aos/lead-store";
import { ConversationNotFoundError, LeadId } from "@aos/lead-store";
import type { WhatsAppConnector } from "@aos/whatsapp-connector";
import { ConflictException, ForbiddenException, Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  LEAD_STORE,
  LEAD_STORE_MESSAGE_REPOSITORY,
  LEAD_STORE_SCORING_REPOSITORY,
  WHATSAPP_CONNECTOR,
} from "../../di-tokens.js";

import type { ClaimLeadBodyDto } from "./dto/claim-lead.dto.js";
import type { CreateLeadBodyDto } from "./dto/create-lead.dto.js";
import type { GetLeadsQueryDto } from "./dto/get-leads.dto.js";
import type { GetMessagesQueryDto } from "./dto/get-messages.dto.js";
import type { GetMyLeadsQueryDto } from "./dto/get-my-leads.dto.js";
import type { InterveneBodyDto } from "./dto/intervene.dto.js";
import {
  toConversationSummaryResponseDto,
  toMessageResponseDto,
  type LeadDetailResponseDto,
  type MessageResponseDto,
} from "./dto/lead-detail-response.dto.js";
import { toLeadResponseDto, type LeadResponseDto } from "./dto/lead-response.dto.js";
import type { MessagesPageResponseDto } from "./dto/messages-page-response.dto.js";
import {
  toScoringEventResponseDto,
  type ScoringEventResponseDto,
} from "./dto/scoring-history-response.dto.js";
import type { SendMessageBodyDto } from "./dto/send-message.dto.js";
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
    @Inject(LEAD_STORE_SCORING_REPOSITORY)
    private readonly scoringRepository: IScoringRepository,
    @Inject(WHATSAPP_CONNECTOR) private readonly whatsAppConnector: WhatsAppConnector,
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

  /**
   * `GET /api/v1/leads/:id/messages` — a paginated view over the real per-message thread
   * (coordinator note #5). `@aos/lead-store`'s `IMessageRepository` has no `LIMIT`/`OFFSET`
   * support of its own, so this fetches the full (already chronologically-ordered) thread once
   * via `findByConversationId` and paginates in memory — an honest tradeoff for a POC-scale
   * conversation volume, not a real database-level `LIMIT`/`OFFSET`. `order: "desc"` reverses the
   * repository's ascending order before slicing.
   */
  async getMessages(leadId: string, query: GetMessagesQueryDto): Promise<MessagesPageResponseDto> {
    const conversationResult = await this.leadStore.getConversation.execute(leadId);
    if (!conversationResult.ok) {
      if (conversationResult.error instanceof ConversationNotFoundError) {
        return { messages: [], page: query.page, limit: query.limit, total: 0 };
      }
      throw conversationResult.error;
    }
    const conversation = conversationResult.value;

    const messagesResult = await this.messageRepository.findByConversationId(conversation.id);
    if (!messagesResult.ok) {
      throw messagesResult.error;
    }
    const ordered =
      query.order === "desc" ? [...messagesResult.value].reverse() : messagesResult.value;
    const start = (query.page - 1) * query.limit;
    const page = ordered.slice(start, start + query.limit).map(toMessageResponseDto);

    return { messages: page, page: query.page, limit: query.limit, total: ordered.length };
  }

  /**
   * `POST /api/v1/leads/:id/message` — a sales human's real reply (coordinator note #5). Validates
   * `body.salesHumanId` matches the lead's real, currently-assigned sales human (throws a Nest
   * `ForbiddenException` — 403 — otherwise, mirroring `claimLead`'s existing "compute the check
   * here, throw a Nest exception directly" pattern for a check `@aos/lead-store` has no use case
   * for), sends via the REAL `SendTextMessage` use case (never a second send path), then persists
   * with `sender_type = 'SALES_HUMAN'`.
   */
  async sendMessage(
    leadId: string,
    body: SendMessageBodyDto,
    correlationId: string,
  ): Promise<MessageResponseDto> {
    return this.sendAndPersist(leadId, body.message, "SALES_HUMAN", body.salesName, correlationId, {
      requireAssignedSalesHumanId: body.salesHumanId,
    });
  }

  /**
   * `POST /api/v1/leads/:id/intervene` — manager-as-Jessy (coordinator note #5). Same send path as
   * `sendMessage`, but persisted with `sender_type = 'MANAGER_INTERVENTION'` — honestly, NOT
   * `'JESSY'` (the spec's own inline comment self-contradicts on this point; the coordinator note
   * resolves it). No `assignedSalesId` check — a manager may intervene on any lead regardless of
   * who it is assigned to.
   */
  async intervene(
    leadId: string,
    body: InterveneBodyDto,
    correlationId: string,
  ): Promise<MessageResponseDto> {
    return this.sendAndPersist(
      leadId,
      body.message,
      "MANAGER_INTERVENTION",
      body.managerName,
      correlationId,
    );
  }

  /**
   * Shared send path for `sendMessage`/`intervene` — both call the REAL `SendTextMessage` use
   * case (never a second, parallel way to send a WhatsApp message) and persist via the REAL
   * `saveMessage` use case, differing only in `senderType`/`senderName` and whether an
   * `assignedSalesId` match is required first.
   */
  private async sendAndPersist(
    leadId: string,
    message: string,
    senderType: "SALES_HUMAN" | "MANAGER_INTERVENTION",
    senderName: string,
    correlationId: string,
    options?: { readonly requireAssignedSalesHumanId?: string },
  ): Promise<MessageResponseDto> {
    const leadResult = await this.leadStore.getLead.execute(leadId);
    if (!leadResult.ok) {
      throw leadResult.error;
    }
    const lead = leadResult.value;

    if (options?.requireAssignedSalesHumanId !== undefined) {
      if (lead.assignedSalesId?.toString() !== options.requireAssignedSalesHumanId) {
        throw new ForbiddenException(
          `Lead ${leadId} is not assigned to sales human ${options.requireAssignedSalesHumanId}`,
        );
      }
    }

    const conversationResult = await this.leadStore.getConversation.execute(leadId);
    if (!conversationResult.ok) {
      throw conversationResult.error;
    }
    const conversation = conversationResult.value;

    const sendResult = await this.whatsAppConnector.sendTextMessage.execute({
      branch: toBranch(lead.branchId),
      to: lead.leadPhone.toString(),
      body: message,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!sendResult.ok) {
      throw sendResult.error;
    }

    const saveResult = await this.leadStore.saveMessage.execute({
      conversationId: conversation.id.toString(),
      direction: "OUTGOING",
      body: message,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
      senderType,
      senderName,
    });
    if (!saveResult.ok) {
      throw saveResult.error;
    }

    return toMessageResponseDto(saveResult.value);
  }

  /** `GET /api/v1/leads/:id/scoring-history` — a thin read over the real `scoring_events` table (coordinator note #5: "no new domain logic"). */
  async getScoringHistory(leadId: string): Promise<readonly ScoringEventResponseDto[]> {
    const idResult = LeadId.create(leadId);
    if (!idResult.ok) {
      throw idResult.error;
    }
    const result = await this.scoringRepository.findByLeadId(idResult.value);
    if (!result.ok) {
      throw result.error;
    }
    return result.value.map(toScoringEventResponseDto);
  }
}
