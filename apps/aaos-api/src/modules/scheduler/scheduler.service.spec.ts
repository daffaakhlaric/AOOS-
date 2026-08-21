import "reflect-metadata";

import type { LeadStore } from "@aos/lead-store";
import {
  AdBuilder,
  AdSetBuilder,
  CampaignBuilder,
  Verdict,
  type AdAccount,
  type MetaAdsConnector,
} from "@aos/meta-ads-connector";
import type { MobixScraperService } from "@aos/mobix-web-scraper";
import type { ObjectiveEngine } from "@aos/objective-engine";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import type { LlmService } from "../llm/llm.service.js";
import type { RecyclingRunResult, RecyclingService } from "../recycling/recycling.service.js";

import type { StoredCalendarEvent } from "./domain/calendar-event.js";
import type { CalendarEventRepository } from "./infrastructure/calendar-event.repository.js";
import { SchedulerService, nextOccurrence, resolveCalendarRange } from "./scheduler.service.js";

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`unwrap failed: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

function buildAdAccount(): AdAccount {
  const ad = unwrap(new AdBuilder().build());
  const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
  const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
  return {
    id: campaign.adSets[0]?.adAccountId,
    name: "Test Ad Account",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [campaign],
    syncedAt: new Date("2026-08-18T00:00:00.000Z"),
  } as unknown as AdAccount;
}

function buildEvent(overrides: Partial<StoredCalendarEvent> = {}): StoredCalendarEvent {
  return {
    id: "evt-1",
    tenantId: "dss-motor",
    eventType: "SCRAPER_RUN",
    title: "Scrape Foto Mobix",
    scheduledAt: "2026-08-19T06:00:00.000Z",
    timezone: "Asia/Jakarta",
    recurrence: "ONCE",
    status: "PENDING",
    createdBy: "system",
    createdAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeRepository(
  overrides: Partial<CalendarEventRepository> = {},
): CalendarEventRepository {
  return {
    create: vi.fn(async (input: { id: string }) => buildEvent({ id: input.id })),
    findById: vi.fn(async () => buildEvent()),
    listByRange: vi.fn(async () => []),
    listDuePending: vi.fn(async () => []),
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    markRunning: vi.fn(async () => undefined),
    markDone: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    markSkipped: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as CalendarEventRepository;
}

function buildFakeConnector(adAccount: AdAccount = buildAdAccount(), ok = true): MetaAdsConnector {
  return {
    pullCampaignData: {
      execute: vi.fn(async () =>
        ok ? { ok: true, value: adAccount } : { ok: false, error: new Error("meta down") },
      ),
    },
    executeVerdict: { execute: vi.fn() },
    client: {},
  } as unknown as MetaAdsConnector;
}

function buildFakeScraper(ok = true): MobixScraperService {
  return {
    runFullScrape: vi.fn(async () =>
      ok
        ? {
            ok: true,
            value: {
              session: { units: [{}, {}] },
              diff: { newUnits: [{}], soldUnits: [] },
              photoResults: [{ succeeded: [{}, {}, {}], failed: [] }],
            },
          }
        : { ok: false, error: new Error("scrape failed") },
    ),
  } as unknown as MobixScraperService;
}

function buildFakeObjectiveEngine(hasObjective = true): ObjectiveEngine {
  const objective = {
    id: "obj-1",
    tenantId: "dss-motor",
    targetHotLeads: { toNumber: () => 100 },
    budgetAllocation: { toNumber: () => 10_000_000 },
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };
  const progress = {
    currentHotLeads: 42,
    currentSpend: { toNumber: () => 3_000_000 },
    daysElapsed: 18,
    daysRemaining: 13,
    progressPercentage: { toNumber: () => 42 },
    dailyRunRate: 2.3,
    requiredDailyRunRate: 3.1,
    forecastedHotLeads: { toNumber: () => 65 },
    budgetBurnRate: 166_666,
    projectedBudgetAtEnd: { toNumber: () => 9_000_000 },
    onTrackStatus: "ON_TRACK",
  };
  return {
    registry: { listByTenant: vi.fn(() => (hasObjective ? [objective] : [])) },
    updateProgress: { execute: vi.fn(async () => ({ ok: true, value: progress })) },
  } as unknown as ObjectiveEngine;
}

function buildFakeLeadStore(hotLeadsPerBranch = 1): LeadStore {
  return {
    getHotLeads: {
      execute: vi.fn(async () => ({ ok: true, value: Array.from({ length: hotLeadsPerBranch }) })),
    },
  } as unknown as LeadStore;
}

function buildFakeLlmService(): LlmService {
  return {
    analyze: vi.fn(async () => ({
      available: true,
      temuan: [],
      rekomendasi: [],
      ringkasan: "ok",
    })),
  } as unknown as LlmService;
}

function buildFakeRecyclingService(result?: RecyclingRunResult): RecyclingService {
  return {
    runRecyclingRun: vi.fn(
      async () => result ?? { summary: "2 broadcast terkirim", attempted: 2, sent: 2, failed: 0 },
    ),
  } as unknown as RecyclingService;
}

function buildService(
  options: {
    repository?: CalendarEventRepository;
    connector?: MetaAdsConnector;
    scraper?: MobixScraperService;
    objectiveEngine?: ObjectiveEngine;
    leadStore?: LeadStore;
    llmService?: LlmService;
    recyclingService?: RecyclingService;
  } = {},
): SchedulerService {
  const config = buildTestConfig();
  const publisher = { publish: vi.fn(async () => undefined) };
  return new SchedulerService(
    config,
    options.connector ?? buildFakeConnector(),
    options.scraper ?? buildFakeScraper(),
    options.objectiveEngine ?? buildFakeObjectiveEngine(),
    options.leadStore ?? buildFakeLeadStore(),
    publisher as never,
    options.llmService ?? buildFakeLlmService(),
    options.repository ?? buildFakeRepository(),
    options.recyclingService ?? buildFakeRecyclingService(),
  );
}

describe("SchedulerService.executeEvent", () => {
  it("marks a stray unsupported event type FAILED with an honest message", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "CAMPAIGN_CREATE" }));

    expect(repository.markFailed).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.stringContaining("tidak didukung"),
    );
    expect(repository.markDone).not.toHaveBeenCalled();
  });

  it("SCRAPER_RUN calls the real RunFullScrape and marks DONE with a real summary", async () => {
    const repository = buildFakeRepository();
    const scraper = buildFakeScraper();
    const service = buildService({ repository, scraper });
    await service.executeEvent(buildEvent({ eventType: "SCRAPER_RUN" }));

    expect(scraper.runFullScrape).toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: expect.stringContaining("unit") }),
    );
  });

  it("SCRAPER_RUN failure marks FAILED", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository, scraper: buildFakeScraper(false) });
    await service.executeEvent(buildEvent({ eventType: "SCRAPER_RUN" }));
    expect(repository.markFailed).toHaveBeenCalled();
  });

  it("TAMARA_PULL_DATA pulls campaigns and reports real counts", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "TAMARA_PULL_DATA" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ campaigns: 1, ads: 1 }),
    );
  });

  it("TAMARA_PULL_DATA fails the event when every ad account pull fails", async () => {
    const repository = buildFakeRepository();
    const service = buildService({
      repository,
      connector: buildFakeConnector(buildAdAccount(), false),
    });
    await service.executeEvent(buildEvent({ eventType: "TAMARA_PULL_DATA" }));
    expect(repository.markFailed).toHaveBeenCalled();
  });

  it("TAMARA_ANALYZE aggregates real PAUSE/SCALE counts from ad verdicts", async () => {
    const ad = unwrap(new AdBuilder().withVerdict(Verdict.PAUSE).build());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = {
      id: campaign.adSets[0]?.adAccountId,
      name: "Acc",
      businessManagerId: "bm",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [campaign],
      syncedAt: new Date(),
    } as unknown as AdAccount;

    const repository = buildFakeRepository();
    const service = buildService({ repository, connector: buildFakeConnector(adAccount) });
    await service.executeEvent(buildEvent({ eventType: "TAMARA_ANALYZE" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ pause: 1, scale: 0, totalAds: 1 }),
    );
  });

  it("KAI_REFRESH_CHECK counts REFRESH decisions from the real VerdictDecisionEngine", async () => {
    const ad = unwrap(new AdBuilder().withVerdict(Verdict.REFRESH).build());
    const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const adAccount = {
      id: campaign.adSets[0]?.adAccountId,
      name: "Acc",
      businessManagerId: "bm",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [campaign],
      syncedAt: new Date(),
    } as unknown as AdAccount;

    const repository = buildFakeRepository();
    const service = buildService({ repository, connector: buildFakeConnector(adAccount) });
    await service.executeEvent(buildEvent({ eventType: "KAI_REFRESH_CHECK" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ refreshNeeded: 1 }),
    );
  });

  it("KAI_REFRESH_CHECK reports zero when no ad needs a refresh", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "KAI_REFRESH_CHECK" }));
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ refreshNeeded: 0, summary: "Tidak ada iklan jenuh" }),
    );
  });

  it("DAILY_DIGEST builds a real digest from the current Objective and pulled AdAccount", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "DAILY_DIGEST" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ currentHotLeads: 42, targetHotLeads: 100 }),
    );
  });

  it("DAILY_DIGEST fails honestly when no Objective exists for the tenant", async () => {
    const repository = buildFakeRepository();
    const service = buildService({
      repository,
      objectiveEngine: buildFakeObjectiveEngine(false),
    });
    await service.executeEvent(buildEvent({ eventType: "DAILY_DIGEST" }));

    expect(repository.markFailed).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.stringContaining("Belum ada Objective"),
    );
  });

  it("RECYCLING_RUN delegates to RecyclingService.runRecyclingRun and marks DONE with its real summary", async () => {
    const repository = buildFakeRepository();
    const recyclingService = buildFakeRecyclingService({
      summary: "3 broadcast terkirim",
      attempted: 3,
      sent: 3,
      failed: 0,
    });
    const service = buildService({ repository, recyclingService });
    await service.executeEvent(buildEvent({ eventType: "RECYCLING_RUN" }));

    expect(recyclingService.runRecyclingRun).toHaveBeenCalled();
    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: "3 broadcast terkirim", sent: 3 }),
    );
  });

  it("RECYCLING_RUN honors Auto Mode OFF with an honest no-op summary", async () => {
    const repository = buildFakeRepository();
    const recyclingService = buildFakeRecyclingService({
      summary: "Auto Mode OFF, tidak ada broadcast dikirim",
      attempted: 0,
      sent: 0,
      failed: 0,
    });
    const service = buildService({ repository, recyclingService });
    await service.executeEvent(buildEvent({ eventType: "RECYCLING_RUN" }));

    expect(repository.markDone).toHaveBeenCalledWith(
      "evt-1",
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ summary: "Auto Mode OFF, tidak ada broadcast dikirim" }),
    );
  });

  it("schedules the next occurrence for a recurring event after a successful run", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "SCRAPER_RUN", recurrence: "DAILY" }));
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ parentEventId: "evt-1", recurrence: "DAILY" }),
    );
  });

  it("does not schedule a next occurrence for a ONCE event", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.executeEvent(buildEvent({ eventType: "SCRAPER_RUN", recurrence: "ONCE" }));
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("SchedulerService.checkAndRunDueEvents", () => {
  it("runs every due PENDING event returned by the repository", async () => {
    const repository = buildFakeRepository({
      listDuePending: vi.fn(async () => [buildEvent({ id: "due-1" })]),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await service.checkAndRunDueEvents();
    expect(repository.markRunning).toHaveBeenCalledWith("due-1", expect.any(String));
  });
});

describe("SchedulerService CRUD", () => {
  it("createEvent persists with createdBy=manager", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.createEvent({
      eventType: "SCRAPER_RUN",
      title: "Scrape",
      scheduledAt: "2026-08-19T06:00:00+07:00",
      recurrence: "ONCE",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "manager", eventType: "SCRAPER_RUN" }),
    );
  });

  it("updateEvent patches an existing event", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.updateEvent("evt-1", { title: "Baru" });
    expect(repository.update).toHaveBeenCalledWith("evt-1", { title: "Baru" });
  });

  it("removeEvent deletes an existing event", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.removeEvent("evt-1");
    expect(repository.delete).toHaveBeenCalledWith("evt-1");
  });

  it("runNow executes the event immediately", async () => {
    const repository = buildFakeRepository();
    const service = buildService({ repository });
    await service.runNow("evt-1");
    expect(repository.markRunning).toHaveBeenCalled();
  });

  it("skip marks SKIPPED and schedules the next occurrence for a recurring event", async () => {
    const repository = buildFakeRepository({
      findById: vi.fn(async () => buildEvent({ recurrence: "DAILY" })),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await service.skip("evt-1");
    expect(repository.markSkipped).toHaveBeenCalledWith("evt-1");
    expect(repository.create).toHaveBeenCalled();
  });

  it("skip does not schedule a next occurrence for a ONCE event", async () => {
    const repository = buildFakeRepository({
      findById: vi.fn(async () => buildEvent({ recurrence: "ONCE" })),
    } as Partial<CalendarEventRepository>);
    const service = buildService({ repository });
    await service.skip("evt-1");
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("nextOccurrence", () => {
  it("returns undefined for ONCE", () => {
    expect(nextOccurrence(buildEvent({ recurrence: "ONCE" }))).toBeUndefined();
  });

  it("adds 1 day for DAILY", () => {
    const next = nextOccurrence(
      buildEvent({ recurrence: "DAILY", scheduledAt: "2026-08-19T06:00:00.000Z" }),
    );
    expect(next?.toISOString()).toBe("2026-08-20T06:00:00.000Z");
  });

  it("adds 1 month for MONTHLY", () => {
    const next = nextOccurrence(
      buildEvent({ recurrence: "MONTHLY", scheduledAt: "2026-08-01T08:00:00.000Z" }),
    );
    expect(next?.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });

  it("WEEKLY advances to the next matching ISO weekday", () => {
    // 2026-08-18 is a Tuesday (isoWeekday 2); recurrenceDays [1] (Senin) -> next Monday.
    const next = nextOccurrence(
      buildEvent({
        recurrence: "WEEKLY",
        recurrenceDays: [1],
        scheduledAt: "2026-08-18T08:00:00.000Z",
      }),
    );
    expect(next?.toISOString()).toBe("2026-08-24T08:00:00.000Z");
  });

  it("WEEKLY with no recurrenceDays returns undefined", () => {
    expect(
      nextOccurrence(buildEvent({ recurrence: "WEEKLY", scheduledAt: "2026-08-18T08:00:00.000Z" })),
    ).toBeUndefined();
  });
});

describe("resolveCalendarRange", () => {
  it("month=YYYY-MM resolves to the full calendar month bounds", () => {
    const { from, to } = resolveCalendarRange(
      { month: "2026-02" },
      new Date("2026-08-18T00:00:00.000Z"),
    );
    expect(from).toBe("2026-02-01T00:00:00.000Z");
    expect(to).toBe("2026-02-28T23:59:59.999Z");
  });

  it("range=this_week resolves from today through the end of the ISO week (Sunday)", () => {
    // 2026-08-18 is a Tuesday.
    const { from, to } = resolveCalendarRange(
      { range: "this_week" },
      new Date("2026-08-18T12:00:00.000Z"),
    );
    expect(from).toBe("2026-08-18T00:00:00.000Z");
    expect(to).toBe("2026-08-23T23:59:59.999Z");
  });
});

describe("SchedulerService constructor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs without throwing given every real dependency token", () => {
    expect(() => buildService()).not.toThrow();
  });
});
