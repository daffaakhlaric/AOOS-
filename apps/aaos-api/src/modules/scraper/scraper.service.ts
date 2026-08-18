import { randomUUID } from "node:crypto";

import { NotFoundError, UnavailableError } from "@aos/errors";
import type { MobixScraperService, ScrapeProgressEvent } from "@aos/mobix-web-scraper";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, MOBIX_SCRAPER_SERVICE } from "../../di-tokens.js";

import type {
  ScrapeJobKind,
  ScrapeJobLogLevel,
  ScrapeJobResult,
  StoredScrapeJob,
} from "./domain/scrape-job.js";
import {
  toScrapedUnitDto,
  toScrapeJobDto,
  toScraperStatusResponseDto,
  type GetStockQueryDto,
  type RunScrapeBodyDto,
  type RunScrapeResponseDto,
  type ScrapedUnitDto,
  type ScrapeJobDto,
  type ScraperStatusResponseDto,
  type StockListResponseDto,
} from "./dto/scraper.dto.js";
import { ScrapeJobRepository } from "./infrastructure/scrape-job.repository.js";

/**
 * Backs `/api/v1/scraper/*` (AAOS-SCRAPER-ASSET-LIBRARY).
 *
 * Job lifecycle mirrors `modules/simulation`'s verified pattern exactly: `run()` persists a
 * `scrape_jobs` row and returns a `jobId` IMMEDIATELY (HTTP 202) — it never holds the connection
 * open for a scrape that downloads and uploads hundreds of photos. The pipeline itself runs as a
 * detached async task (`void this.runJob(...)`), whose errors are caught and persisted inside
 * `runJob` so an unhandled rejection can never crash the process. Progress and logs are written to
 * real `scrape_jobs`/`scrape_job_logs` rows — never a process-local `Map` a restart or a second
 * replica would silently lose — and both `GET .../jobs/:jobId` and the SSE stream read that same
 * persisted state.
 *
 * Every log line written here corresponds to a REAL `ScrapeProgressEvent` the pipeline emitted
 * (`@aos/mobix-web-scraper`'s `RunFullScrape`), never a synthetic progress narration.
 *
 * HONEST SCOPE NOTE on "Scrape Semua Ulang": `RunFullScrape` re-parses the ENTIRE mobixbydss.id
 * listing every run (so every unit's price/km/availability is refreshed in `scraped_units`) but only
 * downloads photos for units it detects as NEW — by deliberate design, to avoid re-uploading
 * hundreds of unchanged photos on every run. A true forced full photo re-ingestion is out of scope;
 * the dashboard's button copy says so plainly.
 */
@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(MOBIX_SCRAPER_SERVICE) private readonly scraper: MobixScraperService,
    private readonly repository: ScrapeJobRepository,
  ) {}

  /** KPI strip + "Status Terakhir" line: real persisted stock aggregates plus the most recent real job. */
  async getStatus(): Promise<ScraperStatusResponseDto> {
    const stats = await this.scraper.getStockStats();
    if (!stats.ok) {
      throw new UnavailableError(stats.error.message);
    }
    const jobs = await this.repository.list(1);
    const lastJob = jobs[0];
    if (lastJob === undefined) {
      return toScraperStatusResponseDto(stats.value);
    }
    const logs = await this.repository.listLogs(lastJob.id);
    return toScraperStatusResponseDto(stats.value, toScrapeJobDto(lastJob, logs));
  }

  async getStock(query: GetStockQueryDto): Promise<StockListResponseDto> {
    const result = await this.scraper.getStockList({
      ...(query.branch !== undefined ? { branch: query.branch } : {}),
      ...(query.available !== undefined ? { available: query.available } : {}),
      ...(query.search !== undefined ? { search: query.search } : {}),
      page: query.page,
      limit: query.limit,
    });
    if (!result.ok) {
      throw new UnavailableError(result.error.message);
    }
    return {
      units: result.value.units.map(toScrapedUnitDto),
      total: result.value.total,
      page: result.value.page,
      limit: result.value.limit,
    };
  }

  async getUnit(unitId: string): Promise<ScrapedUnitDto> {
    const result = await this.scraper.getUnit(unitId);
    if (!result.ok) {
      throw new UnavailableError(result.error.message);
    }
    if (result.value === undefined) {
      throw new NotFoundError(`No scraped unit found with id "${unitId}"`);
    }
    return toScrapedUnitDto(result.value);
  }

  /** Persists the job row and returns immediately — the scrape runs detached. */
  async run(body: RunScrapeBodyDto): Promise<RunScrapeResponseDto> {
    const kind: ScrapeJobKind = body.unitUrl !== undefined ? "UNIT" : "FULL";
    const created = await this.repository.create({
      id: randomUUID(),
      tenantId: this.config.AAOS_TENANT_ID,
      kind,
      ...(body.unitUrl !== undefined ? { unitUrl: body.unitUrl } : {}),
      ...(body.branch !== undefined ? { branch: body.branch } : {}),
    });

    // Detached on purpose — not awaited. Every error path inside `runJob` is caught and persisted.
    void this.runJob(created.id, kind, body.unitUrl);

    return { jobId: created.id, status: "RUNNING", kind };
  }

  async getJob(jobId: string): Promise<ScrapeJobDto> {
    const job = await this.findJobOrThrow(jobId);
    const logs = await this.repository.listLogs(jobId);
    return toScrapeJobDto(job, logs);
  }

  async listJobs(limit = 20): Promise<readonly ScrapeJobDto[]> {
    const jobs = await this.repository.list(limit);
    return jobs.map((job) => toScrapeJobDto(job, []));
  }

  private async findJobOrThrow(jobId: string): Promise<StoredScrapeJob> {
    const job = await this.repository.findById(jobId);
    if (job === undefined) {
      throw new NotFoundError(`No scrape job found with id "${jobId}"`);
    }
    return job;
  }

  private async log(id: string, level: ScrapeJobLogLevel, message: string): Promise<void> {
    try {
      await this.repository.appendLog(id, {
        level,
        message,
        createdAt: new Date().toISOString(),
      });
    } catch (caught) {
      // A log-write failure must never abort the scrape itself.
      this.logger.warn(`ScraperService.log failed for ${id}: ${String(caught)}`);
    }
  }

  /** Translates one real `ScrapeProgressEvent` into a persisted log line (+ progress counters). */
  private async onProgress(id: string, event: ScrapeProgressEvent): Promise<void> {
    switch (event.type) {
      case "listing_parsed":
        await this.safeUpdateProgress(id, 0, event.totalUnits);
        await this.log(
          id,
          "INFO",
          `Listing mobixbydss.id diparse — ${String(event.totalUnits)} unit ditemukan.`,
        );
        return;
      case "diff_computed":
        await this.log(
          id,
          "INFO",
          `Diff: ${String(event.newUnits)} unit baru, ${String(event.soldUnits)} unit terjual/hilang.`,
        );
        return;
      case "unit_photos_done":
        await this.safeUpdateProgress(id, event.current, event.total);
        await this.log(
          id,
          event.failed > 0 ? "WARN" : "INFO",
          `${event.model} (${event.identityKey}): ${String(event.succeeded)} foto tersimpan` +
            (event.failed > 0 ? `, ${String(event.failed)} gagal` : "") +
            ` — ${String(event.current)}/${String(event.total)}.`,
        );
        return;
      case "units_persisted":
        await this.log(id, "INFO", `${String(event.count)} unit disimpan ke database.`);
        return;
      case "persist_failed":
        await this.log(
          id,
          "WARN",
          `Gagal menyimpan metadata unit ke database: ${event.reason}. Scrape & foto tetap berhasil.`,
        );
        return;
      case "branch_fallback":
        // A real mobixbydss.id `cabang` with no matching Branch enum member (e.g. "PONDOK BAMBU",
        // "hq3"). Logged per occurrence so the product gap is visible to whoever reads the job log.
        await this.log(
          id,
          "WARN",
          `Cabang "${event.rawCabang}" (unit ${event.slug}) tidak dikenali — unit dipetakan ke ` +
            `${event.fallback}. Perlu keputusan produk: tambahkan cabang ini ke daftar Branch.`,
        );
        return;
      case "duplicate_unit":
        // REAL BUG FIX regression signal: mobixbydss.id's own listing returned this unit on more
        // than one page of this scrape. Deduplicated automatically (ScrapedUnitRepository keeps the
        // last/freshest occurrence) rather than failing the whole persist step, but logged so the
        // site's own pagination quirk stays visible.
        await this.log(
          id,
          "WARN",
          `Unit ${event.identityKey} muncul lebih dari sekali di listing — hanya versi terakhir ` +
            `yang disimpan.`,
        );
        return;
      /* v8 ignore next 2 -- exhaustive over ScrapeProgressEvent's union; kept for future variants. */
      default:
        return;
    }
  }

  private async safeUpdateProgress(id: string, current: number, total?: number): Promise<void> {
    try {
      await this.repository.updateProgress(id, current, total);
    } catch (caught) {
      this.logger.warn(`ScraperService.updateProgress failed for ${id}: ${String(caught)}`);
    }
  }

  private async runJob(id: string, kind: ScrapeJobKind, unitUrl?: string): Promise<void> {
    try {
      if (kind === "UNIT") {
        await this.runUnitJob(id, unitUrl);
        return;
      }
      await this.runFullJob(id);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      this.logger.error(`ScraperService.runJob(${id}) failed: ${message}`);
      await this.log(id, "ERROR", `Scrape gagal: ${message}`);
      await this.failQuietly(id, message);
    }
  }

  private async runFullJob(id: string): Promise<void> {
    await this.log(
      id,
      "INFO",
      "Mulai scrape seluruh listing mobixbydss.id (foto unit yang sudah ada tidak diunduh ulang).",
    );
    const result = await this.scraper.runFullScrape(id, (event) => {
      // Fire-and-forget per event: the pipeline's own `onProgress` callback is synchronous, and
      // blocking it on a DB write per event would serialize the whole scrape behind Postgres
      // latency. A dropped log line must never fail the scrape, so failures are swallowed here (and
      // already warn-logged inside `log`/`safeUpdateProgress`).
      void this.onProgress(id, event);
    });
    if (!result.ok) {
      await this.log(id, "ERROR", `Scrape gagal: ${result.error.message}`);
      await this.failQuietly(id, result.error.message);
      return;
    }

    const photosStored = result.value.photoResults.reduce(
      (sum, batch) => sum + batch.succeeded.length,
      0,
    );
    const photosFailed = result.value.photoResults.reduce(
      (sum, batch) => sum + batch.failed.length,
      0,
    );
    const jobResult: ScrapeJobResult = {
      unitsScraped: result.value.session.units.length,
      newUnits: result.value.diff.newUnits.length,
      soldUnits: result.value.diff.soldUnits.length,
      photosStored,
      photosFailed,
      ...(result.value.persistedUnits !== undefined
        ? { unitsPersisted: result.value.persistedUnits }
        : {}),
    };
    await this.log(
      id,
      "INFO",
      `Selesai: ${String(jobResult.unitsScraped)} unit, ${String(photosStored)} foto tersimpan` +
        (photosFailed > 0 ? `, ${String(photosFailed)} foto gagal` : "") +
        ".",
    );
    await this.repository.complete(id, jobResult);
  }

  private async runUnitJob(id: string, unitUrl?: string): Promise<void> {
    /* v8 ignore next 4 -- `run()` only ever sets kind="UNIT" when `unitUrl` is defined. */
    if (unitUrl === undefined) {
      await this.failQuietly(id, "A UNIT scrape job requires a unitUrl");
      return;
    }
    await this.log(id, "INFO", `Mulai scrape ulang satu unit: ${unitUrl}`);
    await this.safeUpdateProgress(id, 0, 1);

    const result = await this.scraper.scrapeUnit(unitUrl, id);
    if (!result.ok) {
      await this.log(id, "ERROR", `Scrape unit gagal: ${result.error.message}`);
      await this.failQuietly(id, result.error.message);
      return;
    }

    const photosStored = result.value.photoResult?.succeeded.length ?? 0;
    const photosFailed = result.value.photoResult?.failed.length ?? 0;
    await this.safeUpdateProgress(id, 1, 1);
    if (!result.value.persisted) {
      await this.log(
        id,
        "WARN",
        "Metadata unit gagal disimpan ke database (scrape & foto tetap berhasil).",
      );
    }
    await this.log(
      id,
      photosFailed > 0 ? "WARN" : "INFO",
      `Selesai: ${result.value.unit.identityKey} — ${String(photosStored)} foto tersimpan` +
        (photosFailed > 0 ? `, ${String(photosFailed)} gagal` : "") +
        ".",
    );
    await this.repository.complete(id, {
      unitsScraped: 1,
      newUnits: 0,
      soldUnits: 0,
      photosStored,
      photosFailed,
      unitsPersisted: result.value.persisted ? 1 : 0,
      unitId: result.value.unit.identityKey,
    });
  }

  /** Marks the job failed, swallowing a DB failure on the failure path itself (nothing left to escalate to). */
  private async failQuietly(id: string, message: string): Promise<void> {
    try {
      await this.repository.fail(id, message);
    } catch (caught) {
      this.logger.error(`ScraperService.fail failed for ${id}: ${String(caught)}`);
    }
  }
}
