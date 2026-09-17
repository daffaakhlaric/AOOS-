import { NotFoundError, ValidationError } from "@aos/errors";
import { Injectable } from "@nestjs/common";

import {
  toGrowthObjectiveResponseDto,
  type CreateGrowthObjectiveBodyDto,
  type GrowthObjectiveListResponseDto,
  type GrowthObjectiveResponseDto,
} from "./dto/growth-objective.dto.js";
import type {
  GrowthObjectiveInsert,
  GrowthObjectiveRow,
} from "./infrastructure/growth-objective.repository.js";
import { GrowthObjectiveRepository } from "./infrastructure/growth-objective.repository.js";

/**
 * `modules/growth-objectives` — EYVRA SAMANTHA V2 Phase 1 Part A's Growth Objective domain (a
 * tenant's business goal — "get N Hot Leads by date X"). Every method is tenant-scoped via an
 * explicit `tenantId` parameter (never a column default), same discipline `ListingsService`
 * already establishes.
 *
 * Deliberately does NOT implement `/analyze`, `/replan`, or `/forecast` — those require the
 * Reverse Funnel/Feasibility engines, a separate, later phase (see `growth-objectives.controller.ts`'s
 * commented-out stub routes). This service only covers create/read/list plus the one, honestly
 * limited `activate` transition described below.
 */
@Injectable()
export class GrowthObjectivesService {
  constructor(private readonly repository: GrowthObjectiveRepository) {}

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
   * `PLANNED` -> `ACTIVE` is legal from this method. Today, NOTHING in this codebase ever produces
   * a `PLANNED` objective — that requires Phase 1 Part B's `analyze` endpoint (Reverse Funnel /
   * Feasibility), which this phase explicitly does not implement. This method is therefore an
   * honest placeholder: it will only become reachable in practice once Part B ships, but the guard
   * itself is real (not faked) so Part B can call straight into this method unchanged once it
   * exists, and so a `DRAFT` (or any other status) objective can never be activated by mistake in
   * the meantime.
   */
  async activate(tenantId: string, id: string): Promise<GrowthObjectiveResponseDto> {
    const row = await this.requireRow(tenantId, id);
    if (row.status !== "PLANNED") {
      throw new ValidationError(
        `Growth objective "${id}" cannot be activated from status "${row.status}" — only PLANNED -> ACTIVE is a legal transition (reachable once Phase 1 Part B's feasibility analysis ships)`,
      );
    }
    const updated = await this.repository.update(tenantId, id, {
      status: "ACTIVE",
      updated_at: new Date().toISOString(),
    });
    return toGrowthObjectiveResponseDto(updated);
  }
}
