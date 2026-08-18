import { ok, err } from "@aos/common";
import { UnavailableError, NotFoundError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";
import {
  ScrapedKilometer,
  ScrapedPrice,
  ScrapeTimestamp,
  ScrapeError,
  ScrapedUnit,
  UnitUrl,
  type MobixScraperService,
  type ScrapeProgressListener,
} from "@aos/mobix-web-scraper";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";

import type { ScrapeJobLogEntry, StoredScrapeJob } from "./domain/scrape-job.js";
import type { ScrapeJobRepository } from "./infrastructure/scrape-job.repository.js";
import { ScraperService } from "./scraper.service.js";

function makeUnit(slug = "brio-rs-2021"): ScrapedUnit {
  const url = UnitUrl.create(`https://mobixbydss.id/unit/${slug}`);
  const km = ScrapedKilometer.create(32_000);
  const price = ScrapedPrice.create(145_000_000);
  const at = ScrapeTimestamp.create(new Date("2026-08-14T07:32:00.000Z"));
  if (!url.ok || !km.ok || !price.ok || !at.ok) throw new Error("fixture setup failed");
  const unit = ScrapedUnit.create({
    url: url.value,
    model: "Brio RS",
    brand: "Honda",
    year: 2021,
    transmission: "MT",
    color: "Merah",
    kilometer: km.value,
    price: price.value,
    branch: Branch.BINTARO,
    photos: ["https://cdn.mobixbydss.id/1.jpg"],
    available: true,
    scrapedAt: at.value,
  });
  if (!unit.ok) throw new Error("fixture setup failed");
  return unit.value;
}

/** In-memory stand-in for the real `ScrapeJobRepository`, recording every persisted mutation. */
interface FakeRepo {
  readonly repo: ScrapeJobRepository;
  readonly jobs: Map<string, StoredScrapeJob>;
  readonly logs: ScrapeJobLogEntry[];
  readonly progress: { current: number; total?: number }[];
}

function createFakeRepo(): FakeRepo {
  const jobs = new Map<string, StoredScrapeJob>();
  const logs: ScrapeJobLogEntry[] = [];
  const progress: { current: number; total?: number }[] = [];

  const repo = {
    create: vi.fn(
      async (input: {
        id: string;
        tenantId: string;
        kind: "FULL" | "UNIT";
        unitUrl?: string;
        branch?: string;
      }) => {
        const job: StoredScrapeJob = {
          id: input.id,
          tenantId: input.tenantId,
          kind: input.kind,
          status: "RUNNING",
          ...(input.unitUrl !== undefined ? { unitUrl: input.unitUrl } : {}),
          ...(input.branch !== undefined ? { branch: input.branch } : {}),
          progressCurrent: 0,
          createdAt: "2026-08-17T00:00:00.000Z",
          updatedAt: "2026-08-17T00:00:00.000Z",
        };
        jobs.set(job.id, job);
        return job;
      },
    ),
    findById: vi.fn(async (id: string) => jobs.get(id)),
    list: vi.fn(async (limit = 20) => [...jobs.values()].slice(0, limit)),
    updateProgress: vi.fn(async (id: string, current: number, total?: number) => {
      progress.push({ current, ...(total !== undefined ? { total } : {}) });
      const job = jobs.get(id);
      if (job !== undefined) {
        jobs.set(id, {
          ...job,
          progressCurrent: current,
          ...(total !== undefined ? { progressTotal: total } : {}),
        });
      }
    }),
    complete: vi.fn(async (id: string, result: StoredScrapeJob["result"]) => {
      const job = jobs.get(id);
      if (job !== undefined) {
        jobs.set(id, { ...job, status: "DONE", ...(result !== undefined ? { result } : {}) });
      }
    }),
    fail: vi.fn(async (id: string, errorMessage: string) => {
      const job = jobs.get(id);
      if (job !== undefined) {
        jobs.set(id, { ...job, status: "ERROR", errorMessage });
      }
    }),
    appendLog: vi.fn(async (_id: string, entry: ScrapeJobLogEntry) => {
      logs.push(entry);
    }),
    listLogs: vi.fn(async () => logs),
  } as unknown as ScrapeJobRepository;

  return { repo, jobs, logs, progress };
}

interface ScraperStub {
  readonly scraper: MobixScraperService;
  readonly runFullScrape: ReturnType<typeof vi.fn>;
  readonly scrapeUnit: ReturnType<typeof vi.fn>;
}

function createScraperStub(overrides: Partial<Record<string, unknown>> = {}): ScraperStub {
  const runFullScrape = vi.fn(
    async (_correlationId?: string, onProgress?: ScrapeProgressListener) => {
      onProgress?.({ type: "listing_parsed", totalUnits: 2 });
      onProgress?.({ type: "diff_computed", newUnits: 1, soldUnits: 0 });
      onProgress?.({
        type: "unit_photos_done",
        identityKey: "brio-rs-2021",
        model: "Honda Brio RS 2021",
        current: 1,
        total: 1,
        succeeded: 1,
        failed: 0,
      });
      onProgress?.({ type: "units_persisted", count: 2 });
      return ok({
        session: { units: [makeUnit("a"), makeUnit("b")] },
        diff: { newUnits: [makeUnit("a")], soldUnits: [], unchangedCount: 1 },
        photoResults: [{ unitIdentityKey: "a", succeeded: [{}], failed: [] }],
        persistedUnits: 2,
      });
    },
  );
  const scrapeUnit = vi.fn(async () =>
    ok({
      unit: makeUnit("brio-rs-2021"),
      photoResult: { succeeded: [{}], failed: [] },
      persisted: true,
    }),
  );

  const scraper = {
    runFullScrape,
    scrapeUnit,
    getStockStats: vi.fn(async () =>
      ok({
        totalUnits: 48,
        availableUnits: 45,
        totalPhotos: 312,
        byBranch: { CINERE: 18, BINTARO: 15 },
        lastScrapedAt: "2026-08-14T07:32:00.000Z",
      }),
    ),
    getStockList: vi.fn(async () => ok({ units: [makeUnit("a")], total: 1, page: 1, limit: 50 })),
    getUnit: vi.fn(async () => ok(makeUnit("a"))),
    ...overrides,
  } as unknown as MobixScraperService;

  return { scraper, runFullScrape, scrapeUnit };
}

function build(overrides: Partial<Record<string, unknown>> = {}): {
  service: ScraperService;
  fake: FakeRepo;
  stub: ScraperStub;
} {
  const fake = createFakeRepo();
  const stub = createScraperStub(overrides);
  const service = new ScraperService(buildTestConfig(), stub.scraper, fake.repo);
  return { service, fake, stub };
}

/** Lets the detached `void this.runJob(...)` task settle before assertions. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ScraperService.getStatus", () => {
  it("returns real persisted stock aggregates", async () => {
    const { service } = build();
    const status = await service.getStatus();
    expect(status.totalUnits).toBe(48);
    expect(status.totalPhotos).toBe(312);
    expect(status.byBranch).toEqual({ CINERE: 18, BINTARO: 15 });
    expect(status.lastScrapedAt).toBe("2026-08-14T07:32:00.000Z");
  });

  it("omits lastJob entirely when no job has ever run (never a fabricated placeholder)", async () => {
    const { service } = build();
    const status = await service.getStatus();
    expect(status.lastJob).toBeUndefined();
  });

  it("includes the most recent real job when one exists", async () => {
    const { service } = build();
    await service.run({});
    await flush();
    const status = await service.getStatus();
    expect(status.lastJob).toBeDefined();
    expect(status.lastJob?.kind).toBe("FULL");
  });

  it("raises UnavailableError (→503) when scraped_units persistence isn't configured", async () => {
    const { service } = build({
      getStockStats: vi.fn(async () =>
        err(new ScrapeError("not composed with an IScrapedUnitRepository")),
      ),
    });
    await expect(service.getStatus()).rejects.toThrow(UnavailableError);
  });
});

describe("ScraperService.getStock / getUnit", () => {
  it("maps persisted units to DTOs with real values", async () => {
    const { service } = build();
    const page = await service.getStock({ page: 1, limit: 50 });
    expect(page.total).toBe(1);
    const unit = page.units[0];
    expect(unit?.unitId).toBe("a");
    expect(unit?.priceIdr).toBe(145_000_000);
    expect(unit?.kilometer).toBe(32_000);
    expect(unit?.branch).toBe("BINTARO");
    expect(unit?.photoCount).toBe(1);
  });

  it("forwards only the filters the caller actually supplied", async () => {
    const { service, stub } = build();
    await service.getStock({ page: 2, limit: 10, branch: Branch.CINERE });
    const getStockList = stub.scraper.getStockList as unknown as ReturnType<typeof vi.fn>;
    expect(getStockList).toHaveBeenCalledWith({ branch: Branch.CINERE, page: 2, limit: 10 });
  });

  it("getUnit raises NotFoundError for an unscraped unit", async () => {
    const { service } = build({ getUnit: vi.fn(async () => ok(undefined)) });
    await expect(service.getUnit("nope")).rejects.toThrow(NotFoundError);
  });

  it("getUnit raises UnavailableError when persistence isn't configured", async () => {
    const { service } = build({
      getUnit: vi.fn(async () =>
        err(new ScrapeError("not composed with an IScrapedUnitRepository")),
      ),
    });
    await expect(service.getUnit("a")).rejects.toThrow(UnavailableError);
  });
});

describe("ScraperService.run — async job lifecycle", () => {
  it("returns a jobId immediately without awaiting the scrape", async () => {
    const { service, stub } = build();
    const response = await service.run({});
    expect(response.status).toBe("RUNNING");
    expect(response.kind).toBe("FULL");
    expect(response.jobId).toMatch(/^[0-9a-f-]{36}$/);
    // The scrape has not been awaited by `run` itself.
    void stub;
  });

  it("classifies a body with unitUrl as a UNIT job", async () => {
    const { service } = build();
    const response = await service.run({ unitUrl: "https://mobixbydss.id/unit/brio-a" });
    expect(response.kind).toBe("UNIT");
  });

  it("runs the real full scrape detached and completes the job with MEASURED counts", async () => {
    const { service, fake, stub } = build();
    const { jobId } = await service.run({});
    await flush();

    expect(stub.runFullScrape).toHaveBeenCalled();
    const job = fake.jobs.get(jobId);
    expect(job?.status).toBe("DONE");
    expect(job?.result).toEqual({
      unitsScraped: 2,
      newUnits: 1,
      soldUnits: 0,
      photosStored: 1,
      photosFailed: 0,
      unitsPersisted: 2,
    });
  });

  it("persists a log line for every REAL progress event (and nothing else)", async () => {
    const { service, fake } = build();
    await service.run({});
    await flush();

    const messages = fake.logs.map((entry) => entry.message);
    expect(messages[0]).toContain("Mulai scrape seluruh listing");
    expect(messages.some((m) => m.includes("2 unit ditemukan"))).toBe(true);
    expect(messages.some((m) => m.includes("1 unit baru"))).toBe(true);
    expect(messages.some((m) => m.includes("Honda Brio RS 2021"))).toBe(true);
    expect(messages.some((m) => m.includes("2 unit disimpan ke database"))).toBe(true);
  });

  it("records progress_total only from the real parsed listing count", async () => {
    const { service, fake } = build();
    await service.run({});
    await flush();
    expect(fake.progress[0]).toEqual({ current: 0, total: 2 });
  });

  it("marks the job ERROR with the real message when the scrape fails", async () => {
    const { service, fake } = build({
      runFullScrape: vi.fn(async () => err(new ScrapeError("listing responded with status 503"))),
    });
    const { jobId } = await service.run({});
    await flush();

    const job = fake.jobs.get(jobId);
    expect(job?.status).toBe("ERROR");
    expect(job?.errorMessage).toContain("503");
  });

  it("marks the job ERROR (never crashes) when the pipeline throws", async () => {
    const { service, fake } = build({
      runFullScrape: vi.fn(async () => {
        throw new Error("unexpected boom");
      }),
    });
    const { jobId } = await service.run({});
    await flush();
    expect(fake.jobs.get(jobId)?.status).toBe("ERROR");
    expect(fake.jobs.get(jobId)?.errorMessage).toContain("unexpected boom");
  });

  it("warns honestly (WARN, not silent success) when scraped_units persistence fails mid-run", async () => {
    const { service, fake } = build({
      runFullScrape: vi.fn(async (_c?: string, onProgress?: ScrapeProgressListener) => {
        onProgress?.({ type: "persist_failed", reason: "connection refused" });
        return ok({
          session: { units: [] },
          diff: { newUnits: [], soldUnits: [], unchangedCount: 0 },
          photoResults: [],
        });
      }),
    });
    await service.run({});
    await flush();

    const warning = fake.logs.find((entry) => entry.level === "WARN");
    expect(warning?.message).toContain("connection refused");
    expect(warning?.message).toContain("Scrape & foto tetap berhasil");
  });

  it("logs a WARN naming the real unmapped cabang when a branch falls back to UMUM", async () => {
    const { service, fake } = build({
      runFullScrape: vi.fn(async (_c?: string, onProgress?: ScrapeProgressListener) => {
        onProgress?.({
          type: "branch_fallback",
          rawCabang: "PONDOK BAMBU",
          slug: "mitsubishi-xpander-cross-1-5l-plus-4x2-2023-fdd6a5c3",
          fallback: "UMUM",
        });
        return ok({
          session: { units: [] },
          diff: { newUnits: [], soldUnits: [], unchangedCount: 0 },
          photoResults: [],
        });
      }),
    });
    await service.run({});
    await flush();

    const warning = fake.logs.find((entry) => entry.level === "WARN");
    // The real branch name and unit must both be in the log, so the product gap is actionable.
    expect(warning?.message).toContain("PONDOK BAMBU");
    expect(warning?.message).toContain("mitsubishi-xpander-cross-1-5l-plus-4x2-2023-fdd6a5c3");
    expect(warning?.message).toContain("UMUM");
  });
});

describe("ScraperService.run — UNIT job", () => {
  it("completes with unitId and the real photo counts", async () => {
    const { service, fake, stub } = build();
    const { jobId } = await service.run({ unitUrl: "https://mobixbydss.id/unit/brio-rs-2021" });
    await flush();

    expect(stub.scrapeUnit).toHaveBeenCalledWith("https://mobixbydss.id/unit/brio-rs-2021", jobId);
    const job = fake.jobs.get(jobId);
    expect(job?.status).toBe("DONE");
    expect(job?.result?.unitId).toBe("brio-rs-2021");
    expect(job?.result?.photosStored).toBe(1);
    expect(job?.result?.unitsScraped).toBe(1);
  });

  it("marks the job ERROR when the unit is no longer in the listing", async () => {
    const { service, fake } = build({
      scrapeUnit: vi.fn(async () => err(new ScrapeError('no unit matching "gone" found'))),
    });
    const { jobId } = await service.run({ unitUrl: "https://mobixbydss.id/unit/gone" });
    await flush();
    expect(fake.jobs.get(jobId)?.status).toBe("ERROR");
  });

  it("logs a WARN when the unit re-scrape succeeded but persistence did not", async () => {
    const { service, fake } = build({
      scrapeUnit: vi.fn(async () =>
        ok({ unit: makeUnit("brio-rs-2021"), photoResult: undefined, persisted: false }),
      ),
    });
    await service.run({ unitUrl: "https://mobixbydss.id/unit/brio-rs-2021" });
    await flush();
    expect(fake.logs.some((e) => e.level === "WARN" && e.message.includes("gagal disimpan"))).toBe(
      true,
    );
  });
});

describe("ScraperService.getJob", () => {
  it("returns the persisted job plus its real log rows", async () => {
    const { service } = build();
    const { jobId } = await service.run({});
    await flush();
    const job = await service.getJob(jobId);
    expect(job.id).toBe(jobId);
    expect(job.status).toBe("DONE");
    expect(job.logs.length).toBeGreaterThan(0);
  });

  it("raises NotFoundError for an unknown jobId", async () => {
    const { service } = build();
    await expect(service.getJob("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      NotFoundError,
    );
  });
});
