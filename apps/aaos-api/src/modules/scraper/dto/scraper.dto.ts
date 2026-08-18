import { Branch } from "@aos/meta-ads-connector";
import type { ScrapedUnit, ScrapedUnitStats } from "@aos/mobix-web-scraper";
import { z } from "zod";

import type { ScrapeJobLogEntry, ScrapeJobResult, StoredScrapeJob } from "../domain/scrape-job.js";

/** Real `Branch` enum members only — no fabricated branch ever enters a query (coordinator note #8). */
const BranchSchema = z.nativeEnum(Branch);

/** `GET /api/v1/scraper/stock?branch=&available=&search=&page=&limit=` */
export const GetStockQuerySchema = z.object({
  branch: BranchSchema.optional(),
  // Query strings are always strings — coerced explicitly rather than relying on `z.coerce.boolean`,
  // which treats the literal string "false" as `true`.
  available: z
    .enum(["true", "false"])
    .optional()
    .transform((raw) => (raw === undefined ? undefined : raw === "true")),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type GetStockQueryDto = z.infer<typeof GetStockQuerySchema>;

/**
 * `POST /api/v1/scraper/run` body. `unitUrl` present ⇒ a single-unit re-scrape (`kind: "UNIT"`);
 * absent ⇒ the full-listing scrape (`kind: "FULL"`).
 */
export const RunScrapeBodySchema = z.object({
  unitUrl: z.string().url().optional(),
  branch: BranchSchema.optional(),
});
export type RunScrapeBodyDto = z.infer<typeof RunScrapeBodySchema>;

export interface RunScrapeResponseDto {
  readonly jobId: string;
  readonly status: "RUNNING";
  readonly kind: "FULL" | "UNIT";
}

/** One unit as the dashboard sees it — every field traces to a real persisted `scraped_units` column. */
export interface ScrapedUnitDto {
  readonly unitId: string;
  readonly url: string;
  readonly brand: string;
  readonly model: string;
  readonly year: number;
  readonly transmission: "AT" | "MT";
  readonly color: string;
  readonly kilometer: number;
  readonly priceIdr: number;
  readonly branch: string;
  /** SOURCE listing photo URLs. The GCS-stored copies are `assets` rows — see `GET /api/v1/assets?unitId=`. */
  readonly photos: readonly string[];
  readonly photoCount: number;
  readonly available: boolean;
  readonly scrapedAt: string;
}

export interface StockListResponseDto {
  readonly units: readonly ScrapedUnitDto[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface ScraperStatusResponseDto {
  readonly totalUnits: number;
  readonly availableUnits: number;
  readonly totalPhotos: number;
  readonly byBranch: Readonly<Record<string, number>>;
  /** `undefined` when nothing has ever been scraped — never a fabricated timestamp. */
  readonly lastScrapedAt?: string;
  /** The most recent job, so the page's "Status Terakhir" line reflects a real run. */
  readonly lastJob?: ScrapeJobDto;
}

export interface ScrapeJobDto {
  readonly id: string;
  readonly kind: "FULL" | "UNIT";
  readonly status: "RUNNING" | "DONE" | "ERROR";
  readonly unitUrl?: string;
  readonly branch?: string;
  readonly progressCurrent: number;
  readonly progressTotal?: number;
  readonly result?: ScrapeJobResult;
  readonly errorMessage?: string;
  readonly logs: readonly ScrapeJobLogEntry[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toScrapedUnitDto(unit: ScrapedUnit): ScrapedUnitDto {
  return {
    unitId: unit.identityKey,
    url: unit.url.href,
    brand: unit.brand,
    model: unit.model,
    year: unit.year,
    transmission: unit.transmission,
    color: unit.color,
    kilometer: unit.kilometer.km,
    priceIdr: unit.price.idr,
    branch: unit.branch,
    photos: unit.photos,
    photoCount: unit.photos.length,
    available: unit.available,
    scrapedAt: unit.scrapedAt.toISOString(),
  };
}

export function toScrapeJobDto(
  job: StoredScrapeJob,
  logs: readonly ScrapeJobLogEntry[],
): ScrapeJobDto {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    ...(job.unitUrl !== undefined ? { unitUrl: job.unitUrl } : {}),
    ...(job.branch !== undefined ? { branch: job.branch } : {}),
    progressCurrent: job.progressCurrent,
    ...(job.progressTotal !== undefined ? { progressTotal: job.progressTotal } : {}),
    ...(job.result !== undefined ? { result: job.result } : {}),
    ...(job.errorMessage !== undefined ? { errorMessage: job.errorMessage } : {}),
    logs,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function toScraperStatusResponseDto(
  stats: ScrapedUnitStats,
  lastJob?: ScrapeJobDto,
): ScraperStatusResponseDto {
  return {
    totalUnits: stats.totalUnits,
    availableUnits: stats.availableUnits,
    totalPhotos: stats.totalPhotos,
    byBranch: stats.byBranch,
    ...(stats.lastScrapedAt !== undefined ? { lastScrapedAt: stats.lastScrapedAt } : {}),
    ...(lastJob !== undefined ? { lastJob } : {}),
  };
}
