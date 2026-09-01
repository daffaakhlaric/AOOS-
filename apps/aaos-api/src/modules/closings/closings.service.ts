import type { IClosingRepository, LeadStore } from "@aos/lead-store";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, LEAD_STORE, LEAD_STORE_CLOSING_REPOSITORY } from "../../di-tokens.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";

import { toClosingResponseDto, type ClosingResponseDto } from "./dto/closing-response.dto.js";
import type { CreateClosingBodyDto } from "./dto/create-closing.dto.js";
import type { GetClosingsQueryDto } from "./dto/get-closings.dto.js";

/** Returns the start of the current calendar month in UTC — the default `fromDate` for `GET /api/v1/closings` when the caller doesn't supply one. */
function startOfCurrentMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * `POST /api/v1/closings` writes through `@aos/lead-store`'s `RecordClosing` (the only way a
 * lead's status becomes `CLOSED`). `GET /api/v1/closings` reads raw closing rows via the real
 * `ClosingRepository.findByFilter` composed in `app.module.ts` (AAOS-W4B coordinator note #4's
 * `salesHumanId` filter) — `GetClosingStats` only returns aggregates, not the raw list this
 * endpoint needs.
 */
@Injectable()
export class ClosingsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
    @Inject(LEAD_STORE_CLOSING_REPOSITORY)
    private readonly closingRepository: IClosingRepository,
    /**
     * AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) — Clara's real, honest terminal-state hook. `CLOSED`
     * is the one real, documented terminal `LeadStatus` (`LeadStatusTransition.transitionLeadStatus`'s
     * own doc: "`CLOSED` is terminal: ANY transition attempted from `CLOSED` is rejected"), and
     * `RecordClosing` (called below) is THE only real caller that reaches it — this is the same
     * real, honest "this conversation's outcome is judgeable now" boundary `RecordClosing`'s own
     * doc already draws ("Called by a sales human via the CRM app. This is the ONLY way a lead's
     * `status` becomes `CLOSED`"). Injected the SAME way `LEAD_STORE`/`LEAD_STORE_CLOSING_REPOSITORY`
     * above already reach `packages/lead-store` — a plain constructor injection, no new
     * cross-package access style invented.
     */
    private readonly agentRunsService: AgentRunsService,
  ) {}

  async createClosing(
    body: CreateClosingBodyDto,
    correlationId: string,
  ): Promise<ClosingResponseDto> {
    const result = await this.leadStore.recordClosing.execute({
      leadId: body.leadId,
      salesHumanId: body.salesHumanId,
      closingType: body.closingType,
      unitId: body.unitId,
      unitModel: body.unitModel,
      unitPrice: body.unitPrice,
      campaignId: body.campaignId,
      adId: body.adId,
      commissionIdr: body.commissionIdr,
      commissionPct: body.commissionPct,
      notes: body.notes,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }
    const closing = result.value;
    // AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) — real per-run judging pointer, recorded right after
    // the real closing above is persisted. `runRef` is the real `leads.id` (`Closing` carries no
    // `conversations.id` of its own — `leadId` is the real, natural pointer back to that lead's
    // conversation/message history for a later judge prompt). `context` is a small,
    // judge-prompt-sized summary of the real outcome — never the full `Closing` row (no raw notes,
    // no commission math beyond the two real fields already meaningful to a judge). Best-effort:
    // `AgentRunsService.record` itself never throws, so this can never turn a real, already-recorded
    // closing into a failed request.
    await this.agentRunsService.record(this.config.AAOS_TENANT_ID, "CLARA", body.leadId, {
      closingType: closing.closingType,
      branchId: closing.branchId,
      ...(closing.unitModel !== undefined ? { unitModel: closing.unitModel } : {}),
      ...(closing.commissionIdr !== undefined ? { commissionIdr: closing.commissionIdr } : {}),
      ...(closing.commissionPct !== undefined ? { commissionPct: closing.commissionPct } : {}),
    });
    return toClosingResponseDto(closing);
  }

  async getClosings(query: GetClosingsQueryDto): Promise<readonly ClosingResponseDto[]> {
    const now = new Date();
    const fromDate =
      query.fromDate !== undefined ? new Date(query.fromDate) : startOfCurrentMonthUtc(now);
    const toDate = query.toDate !== undefined ? new Date(query.toDate) : now;

    const result = await this.closingRepository.findByFilter({
      salesHumanId: query.salesHumanId,
      branchId: query.branchId,
      campaignId: query.campaignId,
      adId: query.adId,
      fromDate,
      toDate,
    });
    if (!result.ok) {
      throw result.error;
    }
    return result.value.map(toClosingResponseDto);
  }
}
