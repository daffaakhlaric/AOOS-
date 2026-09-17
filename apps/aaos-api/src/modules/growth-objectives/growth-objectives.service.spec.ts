import { NotFoundError, ValidationError } from "@aos/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EvaluatableLead } from "../hot-lead-definitions/domain/evaluate-hot-lead.js";
import type { HotLeadDefinitionResponseDto } from "../hot-lead-definitions/dto/hot-lead-definition.dto.js";
import type { HotLeadDefinitionsService } from "../hot-lead-definitions/hot-lead-definitions.service.js";
import type { MetricSnapshotDto } from "../metric-snapshot/dto/metric-snapshot.dto.js";
import type { MetricSnapshotService } from "../metric-snapshot/metric-snapshot.service.js";

import type { CreateGrowthObjectiveBodyDto } from "./dto/growth-objective.dto.js";
import { GrowthObjectivesService } from "./growth-objectives.service.js";
import type { GrowthMetricsRepository } from "./infrastructure/growth-metrics.repository.js";
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
    // Merges the update payload into a fresh row so callers observing the returned DTO see their
    // own real update reflected (e.g. `analyze()`'s `status: "PLANNED"`), not a hardcoded stand-in.
    update: vi.fn(async (_tenantId: string, _id: string, values: Partial<GrowthObjectiveRow>) =>
      makeRow({ status: "ACTIVE", ...values }),
    ),
  } as unknown as GrowthObjectiveRepository;
}

function makeGrowthMetricsRepository(
  overrides: Partial<GrowthMetricsRepository> = {},
): GrowthMetricsRepository {
  return {
    countRawLeads: vi.fn(async () => 0),
    listLeadsForHotEvaluation: vi.fn(async (): Promise<readonly EvaluatableLead[]> => []),
    ...overrides,
  } as unknown as GrowthMetricsRepository;
}

const HOT_LEAD_DEFINITION: HotLeadDefinitionResponseDto = {
  tenantId: TENANT,
  mode: "LEAD_STATUS",
  leadStatusValue: "HOT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeHotLeadDefinitionsService(
  definition: HotLeadDefinitionResponseDto | undefined = HOT_LEAD_DEFINITION,
): HotLeadDefinitionsService {
  return {
    get: vi.fn(async () => definition),
  } as unknown as HotLeadDefinitionsService;
}

function makeAccountSnapshot(overrides: Partial<MetricSnapshotDto> = {}): MetricSnapshotDto {
  return {
    window: "last_30_days",
    spend: 3_000_000,
    impressions: 25_000,
    clicks: 500,
    reach: 20_000,
    leads: 60,
    ctr: 0.02,
    cpm: 120_000,
    cpc: 6_000,
    cpl: 50_000,
    frequency: 1.25,
    sampleSize: { impressions: 25_000, clicks: 500, leads: 60 },
    daysCovered: 30,
    dataSufficiency: { level: "HIGH", score: 100, reasons: [] },
    ...overrides,
  };
}

function makeMetricSnapshotService(
  snapshot: MetricSnapshotDto = makeAccountSnapshot(),
): MetricSnapshotService {
  return {
    getAccountSnapshot: vi.fn(async () => snapshot),
    getCampaignSnapshot: vi.fn(async () => snapshot),
  } as unknown as MetricSnapshotService;
}

describe("GrowthObjectivesService", () => {
  let repository: GrowthObjectiveRepository;
  let growthMetricsRepository: GrowthMetricsRepository;
  let hotLeadDefinitions: HotLeadDefinitionsService;
  let metricSnapshots: MetricSnapshotService;
  let service: GrowthObjectivesService;

  beforeEach(() => {
    repository = makeRepository();
    growthMetricsRepository = makeGrowthMetricsRepository();
    hotLeadDefinitions = makeHotLeadDefinitionsService();
    metricSnapshots = makeMetricSnapshotService();
    service = new GrowthObjectivesService(
      repository,
      growthMetricsRepository,
      hotLeadDefinitions,
      metricSnapshots,
    );
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

  describe("analyze()", () => {
    it("happy path: computes and persists a real forecast, transitioning DRAFT -> PLANNED", async () => {
      repository.findById = vi.fn(async () =>
        makeRow({ status: "DRAFT", target_value: 20, end_date: "2099-01-31" }),
      );
      growthMetricsRepository = makeGrowthMetricsRepository({
        countRawLeads: vi.fn(async () => 100),
        listLeadsForHotEvaluation: vi.fn(async () =>
          Array.from({ length: 100 }, (_, i) => ({
            status: i < 15 ? "HOT" : "NEW",
            score: i < 15 ? 90 : 10,
            qualification: {
              budget: false,
              unit: false,
              area: false,
              payment: false,
              timeline: false,
              name: false,
            },
          })),
        ),
      });
      repository.update = vi.fn(async (_tenantId, _id, values) =>
        makeRow({ ...values, status: "PLANNED" } as Partial<GrowthObjectiveRow>),
      );
      service = new GrowthObjectivesService(
        repository,
        growthMetricsRepository,
        hotLeadDefinitions,
        metricSnapshots,
      );

      const dto = await service.analyze(TENANT, "obj-1");

      expect(hotLeadDefinitions.get).toHaveBeenCalledWith(TENANT);
      expect(growthMetricsRepository.countRawLeads).toHaveBeenCalledWith(
        TENANT,
        expect.any(String),
        expect.any(String),
      );
      expect(metricSnapshots.getAccountSnapshot).toHaveBeenCalledWith(TENANT, "last_30_days");
      expect(repository.update).toHaveBeenCalledWith(
        TENANT,
        "obj-1",
        expect.objectContaining({
          status: "PLANNED",
          forecast: expect.objectContaining({
            reverseFunnel: expect.any(Object),
            feasibility: expect.any(Object),
          }),
          forecast_computed_at: expect.any(String),
        }),
      );
      expect(dto.status).toBe("PLANNED");
      expect(dto.forecast).toBeDefined();
      expect(dto.forecastComputedAt).toBeDefined();
    });

    it("throws ValidationError when the tenant has no HotLeadDefinition (never silently defaults)", async () => {
      repository.findById = vi.fn(async () => makeRow({ status: "DRAFT" }));
      hotLeadDefinitions = {
        get: vi.fn(async () => undefined),
      } as unknown as HotLeadDefinitionsService;
      service = new GrowthObjectivesService(
        repository,
        growthMetricsRepository,
        hotLeadDefinitions,
        metricSnapshots,
      );
      await expect(service.analyze(TENANT, "obj-1")).rejects.toThrow(ValidationError);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("throws ValidationError from an illegal starting status (e.g. ACTIVE)", async () => {
      repository.findById = vi.fn(async () => makeRow({ status: "ACTIVE" }));
      await expect(service.analyze(TENANT, "obj-1")).rejects.toThrow(ValidationError);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("allows REPLANNING -> PLANNED (analyze is also the replan path)", async () => {
      repository.findById = vi.fn(async () => makeRow({ status: "REPLANNING" }));
      const dto = await service.analyze(TENANT, "obj-1");
      expect(dto.status).toBe("PLANNED");
    });

    it("throws NotFoundError for a missing objective", async () => {
      repository.findById = vi.fn(async () => undefined);
      await expect(service.analyze(TENANT, "missing")).rejects.toThrow(NotFoundError);
    });

    it("succeeds with an honest low-confidence/INSUFFICIENT_DATA result when there is zero historical data — never throws just because data is sparse", async () => {
      repository.findById = vi.fn(async () => makeRow({ status: "DRAFT" }));
      growthMetricsRepository = makeGrowthMetricsRepository({
        countRawLeads: vi.fn(async () => 0),
        listLeadsForHotEvaluation: vi.fn(async () => []),
      });
      metricSnapshots = makeMetricSnapshotService(
        makeAccountSnapshot({
          spend: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          leads: 0,
          ctr: undefined,
          cpm: undefined,
          cpc: undefined,
          cpl: undefined,
          frequency: undefined,
          sampleSize: { impressions: 0, clicks: 0, leads: 0 },
          daysCovered: 0,
          dataSufficiency: { level: "INSUFFICIENT", score: 0, reasons: ["no data"] },
        }),
      );
      service = new GrowthObjectivesService(
        repository,
        growthMetricsRepository,
        hotLeadDefinitions,
        metricSnapshots,
      );

      const dto = await service.analyze(TENANT, "obj-1");
      expect(dto.status).toBe("PLANNED");
      const forecast = dto.forecast!;
      expect(forecast.reverseFunnel.confidence).toBe(0);
      expect(forecast.feasibility.status).toBe("INSUFFICIENT_DATA");
    });
  });
});
