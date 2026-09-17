import { NotFoundError, ValidationError } from "@aos/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateGrowthObjectiveBodyDto } from "./dto/growth-objective.dto.js";
import { GrowthObjectivesService } from "./growth-objectives.service.js";
import type {
  GrowthObjectiveRepository,
  GrowthObjectiveRow,
} from "./infrastructure/growth-objective.repository.js";

const TENANT = "propertyklik-demo";

function makeRow(overrides: Partial<GrowthObjectiveRow> = {}): GrowthObjectiveRow {
  return {
    id: "obj-1",
    tenant_id: TENANT,
    metric: "HOT_LEADS",
    target_value: 50,
    start_date: "2026-01-01",
    end_date: "2026-01-31",
    budget_mode: "BALANCED",
    max_budget_idr: 10_000_000,
    focus_listing_ids: [],
    area_strategy: "SAMANTHA",
    manual_areas: [],
    automation_mode: "ADVISOR",
    status: "DRAFT",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCreateBody(
  overrides: Partial<CreateGrowthObjectiveBodyDto> = {},
): CreateGrowthObjectiveBodyDto {
  return {
    metric: "HOT_LEADS",
    targetValue: 50,
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    budgetMode: "BALANCED",
    areaStrategy: "SAMANTHA",
    automationMode: "ADVISOR",
    ...overrides,
  };
}

function makeRepository(): GrowthObjectiveRepository {
  return {
    create: vi.fn(async () => makeRow()),
    findById: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    update: vi.fn(async () => makeRow({ status: "ACTIVE" })),
  } as unknown as GrowthObjectiveRepository;
}

describe("GrowthObjectivesService", () => {
  let repository: GrowthObjectiveRepository;
  let service: GrowthObjectivesService;

  beforeEach(() => {
    repository = makeRepository();
    service = new GrowthObjectivesService(repository);
  });

  it("create() writes a DRAFT-status insert built from the tenant + body", async () => {
    await service.create(
      TENANT,
      makeCreateBody({ maxBudgetIdr: 5_000_000, focusListingIds: ["l-1"] }),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT,
        metric: "HOT_LEADS",
        target_value: 50,
        status: "DRAFT",
        max_budget_idr: 5_000_000,
        focus_listing_ids: ["l-1"],
      }),
    );
  });

  it("create() defaults optional array/nullable fields", async () => {
    await service.create(TENANT, makeCreateBody());
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        max_budget_idr: null,
        focus_listing_ids: [],
        manual_areas: [],
      }),
    );
  });

  it("create() returns the mapped response DTO", async () => {
    const dto = await service.create(TENANT, makeCreateBody());
    expect(dto).toEqual(
      expect.objectContaining({ id: "obj-1", tenantId: TENANT, status: "DRAFT" }),
    );
  });

  it("getById() returns the mapped DTO for an existing, same-tenant row", async () => {
    repository.findById = vi.fn(async () => makeRow());
    const dto = await service.getById(TENANT, "obj-1");
    expect(dto.id).toBe("obj-1");
  });

  it("getById() throws NotFoundError when no row matches", async () => {
    repository.findById = vi.fn(async () => undefined);
    await expect(service.getById(TENANT, "missing")).rejects.toThrow(NotFoundError);
  });

  it("list() maps every row to a response DTO", async () => {
    repository.list = vi.fn(async () => [makeRow(), makeRow({ id: "obj-2" })]);
    const result = await service.list(TENANT);
    expect(result.objectives).toHaveLength(2);
    expect(result.objectives.map((o) => o.id)).toEqual(["obj-1", "obj-2"]);
  });

  it("activate() transitions a PLANNED objective to ACTIVE", async () => {
    repository.findById = vi.fn(async () => makeRow({ status: "PLANNED" }));
    const dto = await service.activate(TENANT, "obj-1");
    expect(repository.update).toHaveBeenCalledWith(
      TENANT,
      "obj-1",
      expect.objectContaining({ status: "ACTIVE" }),
    );
    expect(dto.status).toBe("ACTIVE");
  });

  it("activate() throws ValidationError from any non-PLANNED status (e.g. DRAFT)", async () => {
    repository.findById = vi.fn(async () => makeRow({ status: "DRAFT" }));
    await expect(service.activate(TENANT, "obj-1")).rejects.toThrow(ValidationError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("activate() throws ValidationError from ACTIVE (already active, not re-activatable)", async () => {
    repository.findById = vi.fn(async () => makeRow({ status: "ACTIVE" }));
    await expect(service.activate(TENANT, "obj-1")).rejects.toThrow(ValidationError);
  });

  it("activate() throws NotFoundError for a missing objective", async () => {
    repository.findById = vi.fn(async () => undefined);
    await expect(service.activate(TENANT, "missing")).rejects.toThrow(NotFoundError);
  });
});
