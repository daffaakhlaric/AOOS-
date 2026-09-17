import { NotFoundError, ValidationError } from "@aos/errors";
import { Injectable } from "@nestjs/common";

import { evaluateHotLead } from "../hot-lead-definitions/domain/evaluate-hot-lead.js";
import { HotLeadDefinitionsService } from "../hot-lead-definitions/hot-lead-definitions.service.js";
import { resolveBenchmark } from "../metric-snapshot/domain/benchmark.js";
import { MetricSnapshotService } from "../metric-snapshot/metric-snapshot.service.js";

import { assessFeasibility } from "./domain/feasibility.js";
import { computeReverseFunnel } from "./domain/reverse-funnel.js";
import {
  toGrowthObjectiveResponseDto,
  type CreateGrowthObjectiveBodyDto,
  type GrowthObjectiveForecastDto,
  type GrowthObjectiveListResponseDto,
  type GrowthObjectiveResponseDto,
} from "./dto/growth-objective.dto.js";
import { GrowthMetricsRepository } from "./infrastructure/growth-metrics.repository.js";
import type {
  GrowthObjectiveInsert,
  GrowthObjectiveRow,
} from "./infrastructure/growth-objective.repository.js";
import { GrowthObjectiveRepository } from "./infrastructure/growth-objective.repository.js";

/**
 * Real, fixed lookback window `analyze()` uses to gather historical raw/hot lead counts —
 * deliberately independent of the objective's OWN `start_date`/`end_date` (those describe the
 * FUTURE goal period being planned for, not historical data availability). 30 days matches
 * `MetricSnapshotService`'s own `"last_30_days"` window key, so the same real calendar range backs
 * both the lead-volume counts (`GrowthMetricsRepository`) and the CPL benchmark
 * (`MetricSnapshotService.getAccountSnapshot`) `analyze()` combines below — kept in sync rather than
 * two different windows fabricating a false sense of alignment.
 */
export const ANALYZE_LOOKBACK_DAYS = 30;

/**
 * `modules/growth-objectives` — EYVRA SAMANTHA V2 Phase 1 Part A/B's Growth Objective domain (a
 * tenant's business goal — "get N Hot Leads by date X"). Every method is tenant-scoped via an
 * explicit `tenantId` parameter (never a column default), same discipline `ListingsService`
 * already establishes.
 *
 * Phase 1 Part B wires the real `/analyze` endpoint (Reverse Funnel + Feasibility) — see `analyze()`
 * below. `/replan`/`/forecast` (a read-only re-fetch of the last stored `forecast`, distinct from
 * `/analyze` which re-COMPUTES it) remain out of scope for this phase; `GET /:id` already exposes
 * the last stored `forecast`/`forecastComputedAt` via `toGrowthObjectiveResponseDto`, which is
 * enough for a client to read it without a dedicated route.
 */
@Injectable()
export class GrowthObjectivesService {
  constructor(
    private readonly repository: GrowthObjectiveRepository,
    private readonly growthMetricsRepository: GrowthMetricsRepository,
    private readonly hotLeadDefinitions: HotLeadDefinitionsService,
    private readonly metricSnapshots: MetricSnapshotService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateGrowthObjectiveBodyDto,
  ): Promise<GrowthObjectiveResponseDto> {
    const insert: GrowthObjectiveInsert = {
      tenant_id: tenantId,
      metric: dto.metric,
      target_value: dto.targetValue,
      start_date: dto.startDate,
      end_date: dto.endDate,
      budget_mode: dto.budgetMode,
      max_budget_idr: dto.maxBudgetIdr ?? null,
      focus_listing_ids: dto.focusListingIds ?? [],
      area_strategy: dto.areaStrategy,
      manual_areas: dto.manualAreas ?? [],
      automation_mode: dto.automationMode,
      status: "DRAFT",
    };
    const row = await this.repository.create(insert);
    return toGrowthObjectiveResponseDto(row);
  }

  private async requireRow(tenantId: string, id: string): Promise<GrowthObjectiveRow> {
    const row = await this.repository.findById(tenantId, id);
    if (row === undefined) {
      throw new NotFoundError(`No growth objective found for id "${id}"`);
    }
    return row;
  }

  async getById(tenantId: string, id: string): Promise<GrowthObjectiveResponseDto> {
    return toGrowthObjectiveResponseDto(await this.requireRow(tenantId, id));
  }

  async list(tenantId: string): Promise<GrowthObjectiveListResponseDto> {
    const rows = await this.repository.list(tenantId);
    return { objectives: rows.map(toGrowthObjectiveResponseDto) };
  }

  /**
   * `POST /api/v1/growth-objectives/:id/activate`. Real status-transition guard: only
   * `PLANNED` -> `ACTIVE` is legal from this method. `PLANNED` is now genuinely reachable via
   * `analyze()` below (Phase 1 Part B), so this guard is no longer a placeholder — a `DRAFT` (or any
   * other status) objective still can never be activated by mistake.
   */
  async activate(tenantId: string, id: string): Promise<GrowthObjectiveResponseDto> {
    const row = await this.requireRow(tenantId, id);
    if (row.status !== "PLANNED") {
      throw new ValidationError(
        `Growth objective "${id}" cannot be activated from status "${row.status}" — only PLANNED -> ACTIVE is a legal transition (reachable via POST /:id/analyze)`,
      );
    }
    const updated = await this.repository.update(tenantId, id, {
      status: "ACTIVE",
      updated_at: new Date().toISOString(),
    });
    return toGrowthObjectiveResponseDto(updated);
  }

  /**
   * `POST /api/v1/growth-objectives/:id/analyze`. The ONLY legal way to reach `PLANNED` from
   * `DRAFT`/`REPLANNING` — any other starting status throws (same guard discipline `activate()`
   * establishes for its own `PLANNED -> ACTIVE` transition).
   *
   * Real pipeline: loads the tenant's `HotLeadDefinition` (throws a `ValidationError` if the tenant
   * hasn't defined one yet — never silently defaults, per that service's own `get()` doc), fetches
   * real historical raw-lead/hot-lead counts over the last `ANALYZE_LOOKBACK_DAYS` days via
   * `GrowthMetricsRepository` (evaluating hotness in application code via the real, pure
   * `evaluateHotLead` — never SQL-side), resolves a trustworthy (`confidence` `HIGH`/`MEDIUM` only)
   * CPL benchmark from the account's real `last_30_days` `MetricSnapshotDto` via `resolveBenchmark`,
   * computes real `daysRemaining` (from `row.end_date`, clamped to `>= 0` — a window that has
   * already ended is a real, honest `0`, never a negative number) and
   * `currentDailySpendCapacityIdr` (`spend / daysCovered` off that same account snapshot), then
   * runs `computeReverseFunnel` -> `assessFeasibility` and persists `{forecast, forecast_computed_at,
   * status: "PLANNED"}`.
   */
  async analyze(tenantId: string, id: string): Promise<GrowthObjectiveResponseDto> {
    const row = await this.requireRow(tenantId, id);
    if (row.status !== "DRAFT" && row.status !== "REPLANNING") {
      throw new ValidationError(
        `Growth objective "${id}" cannot be analyzed from status "${row.status}" — only DRAFT/REPLANNING -> PLANNED is a legal transition`,
      );
    }

    const hotLeadDefinition = await this.hotLeadDefinitions.get(tenantId);
    if (hotLeadDefinition === undefined) {
      throw new ValidationError(
        `Tenant "${tenantId}" belum mendefinisikan Hot Lead — definisikan Hot Lead terlebih dahulu (PUT /api/v1/hot-lead-definitions) sebelum menjalankan analisa Growth Objective ini.`,
      );
    }

    const now = new Date();
    const since = new Date(now.getTime());
    since.setUTCDate(since.getUTCDate() - (ANALYZE_LOOKBACK_DAYS - 1));
    const sinceIso = since.toISOString();
    const untilIso = now.toISOString();

    const [historicalRawLeads, evaluatableLeads, accountSnapshot] = await Promise.all([
      this.growthMetricsRepository.countRawLeads(tenantId, sinceIso, untilIso),
      this.growthMetricsRepository.listLeadsForHotEvaluation(tenantId, sinceIso, untilIso),
      this.metricSnapshots.getAccountSnapshot(tenantId, "last_30_days"),
    ]);

    const historicalHotLeads = evaluatableLeads.filter((lead) =>
      evaluateHotLead(lead, hotLeadDefinition),
    ).length;

    const benchmark = resolveBenchmark({ tenantId }, { accountHistorical: accountSnapshot });
    const historicalCplIdr =
      benchmark.confidence === "HIGH" || benchmark.confidence === "MEDIUM"
        ? benchmark.cpl
        : undefined;

    const todayDateOnly = now.toISOString().slice(0, 10);
    const daysRemaining = Math.max(
      0,
      Math.round(
        (new Date(`${row.end_date}T00:00:00.000Z`).getTime() -
          new Date(`${todayDateOnly}T00:00:00.000Z`).getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    );
    const currentDailySpendCapacityIdr =
      accountSnapshot.spend / Math.max(accountSnapshot.daysCovered, 1);

    const reverseFunnel = computeReverseFunnel({
      targetHotLeads: row.target_value,
      historicalRawLeads,
      historicalHotLeads,
      historicalCplIdr,
    });
    const feasibility = assessFeasibility({
      reverseFunnel,
      daysRemaining,
      maxBudgetIdr: row.max_budget_idr ?? undefined,
      currentDailySpendCapacityIdr,
    });

    const forecast: GrowthObjectiveForecastDto = { reverseFunnel, feasibility };
    const updated = await this.repository.update(tenantId, id, {
      forecast,
      forecast_computed_at: now.toISOString(),
      status: "PLANNED",
      updated_at: now.toISOString(),
    });
    return toGrowthObjectiveResponseDto(updated);
  }
}
