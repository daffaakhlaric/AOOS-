import { ConflictError, NotFoundError } from "@aos/errors";
import { Injectable, Optional } from "@nestjs/common";

import { MetaAdsService } from "../meta-ads/meta-ads.service.js";

import {
  toPropertyObjectiveResponseDto,
  type BudgetSuggestionResponseDto,
  type CreatePropertyObjectiveBodyDto,
  type PropertyObjectiveResponseDto,
  type PropertyObjectiveRow,
} from "./dto/property-objective.dto.js";
import { PropertyObjectiveRepository } from "./property-objective.repository.js";

/** Statuses `PropertyObjectiveService.create`'s "max 1 active/draft objective per tenant per period" rule counts against — mirrors `CreateObjective.countActiveForPeriod`'s exact `ACTIVE`/`DRAFT` set. */
const BLOCKING_STATUSES: readonly string[] = ["DRAFT", "ACTIVE"];

/**
 * `modules/property-objective` (Phase O1) — the genuinely SEPARATE PROPERTY equivalent of
 * `ObjectiveService`, backed by the new `property_objectives` table (Supabase-persisted, unlike
 * `objective-engine`'s in-memory-only AUTOMOTIVE store — see the migration's own header doc).
 * Deliberately does NOT touch `packages/objective-engine`'s `AreaPriority`/`FocusUnit` value
 * objects or `CreateObjective` use case.
 */
@Injectable()
export class PropertyObjectiveService {
  constructor(
    private readonly repository: PropertyObjectiveRepository,
    private readonly metaAdsService: MetaAdsService,
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * "Current objective" = the most recently created DRAFT/ACTIVE row for this tenant's current
   * real period (month/year) — same real "current month" framing `ObjectiveService
   * .getCurrentObjective` establishes for AUTOMOTIVE, adapted to this table's real period columns.
   */
  async get(tenantId: string): Promise<PropertyObjectiveResponseDto> {
    const now = this.now();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const rows = await this.repository.listByTenant(tenantId);
    const current = rows
      .filter(
        (row) =>
          row.period_month === month &&
          row.period_year === year &&
          BLOCKING_STATUSES.includes(row.status),
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (current === undefined) {
      throw new NotFoundError(
        `No PROPERTY objective found for tenant "${tenantId}" for ${String(year)}-${String(month)}`,
      );
    }
    return toPropertyObjectiveResponseDto(current);
  }

  /**
   * Real business rule: `budgetAllocation` is always required (see
   * `CreatePropertyObjectiveBodySchema`'s own doc for the full reasoning) — this method never
   * invents a budget number, it only ever persists what the validated body already carries.
   *
   * Enforces max 1 active/draft PROPERTY objective per tenant per period — same real rule
   * `CreateObjective.countActiveForPeriod` enforces for AUTOMOTIVE, adapted to this table.
   */
  async create(
    tenantId: string,
    body: CreatePropertyObjectiveBodyDto,
  ): Promise<PropertyObjectiveResponseDto> {
    const now = this.now();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();

    const rows = await this.repository.listByTenant(tenantId);
    const existingCount = rows.filter(
      (row: PropertyObjectiveRow) =>
        row.period_month === month &&
        row.period_year === year &&
        BLOCKING_STATUSES.includes(row.status),
    ).length;
    if (existingCount >= 1) {
      throw new ConflictError(
        `Tenant "${tenantId}" already has ${String(existingCount)} active/draft PROPERTY objective(s) for ${String(year)}-${String(month)} (max 1)`,
      );
    }

    const row = await this.repository.create({
      tenantId,
      periodMonth: month,
      periodYear: year,
      targetHotLeads: body.targetHotLeads,
      budgetAllocation: body.budgetAllocation,
      budgetSource: body.budgetSource,
      focusListings: body.focusListings,
      areaPriorities: body.areaPriorities,
    });
    return toPropertyObjectiveResponseDto(row);
  }

  /**
   * `GET /property-objective/budget-suggestion` (Finding 4) — `suggestedBudget = targetHotLeads *
   * portfolioAvgCplIDR`, where `portfolioAvgCplIDR` is this tenant's own real average `rphLead`
   * across every currently-loaded ad with a computable value, the SAME honest calculation
   * `CampaignTable.tsx`'s `computePortfolioAvgCplIDR` performs client-side — computed server-side
   * here since this is a real aaos-api endpoint. Reuses `MetaAdsService.pullCampaigns` (the SAME
   * real Meta pull `MetaAdsController`'s `GET /api/v1/campaigns` already performs) — no second Meta
   * call invented. Honestly reports `available: false` (never a fabricated default number) when the
   * tenant has zero computable CPL values, mirroring `OverviewService.safeFetch`'s/`AiJudgeService`'s
   * honest-degrade discipline.
   */
  async getBudgetSuggestion(
    targetHotLeads: number,
    correlationId: string,
    tenantId: string,
  ): Promise<BudgetSuggestionResponseDto> {
    const adAccount = await this.metaAdsService.pullCampaigns(
      { datePreset: "last_30d" },
      correlationId,
      tenantId,
    );
    const cplValues = adAccount.campaigns
      .flatMap((campaign) => campaign.adSets.flatMap((adSet) => adSet.ads))
      .map((ad) => ad.metrics.rphLead)
      .filter((value): value is number => value !== null);

    if (cplValues.length === 0) {
      return {
        available: false,
        reason:
          "No real campaign data with a computable cost-per-lead (rphLead) is available yet for this tenant — a budget suggestion cannot be honestly computed.",
      };
    }

    const portfolioAvgCplIDR = cplValues.reduce((sum, value) => sum + value, 0) / cplValues.length;
    return {
      available: true,
      suggestedBudget: targetHotLeads * portfolioAvgCplIDR,
      portfolioAvgCplIDR,
      targetHotLeads,
    };
  }
}
