/**
 * Persisted state of one scrape job (AAOS-SCRAPER-ASSET-LIBRARY). Mirrors
 * `modules/simulation/domain/simulation-record.ts`'s shape convention: a plain `Stored*` interface
 * in camelCase, mapped to/from snake_case rows inside the repository — nothing else in the module
 * knows the DB column names.
 *
 * Job state is PERSISTED, never held in a process-local `Map`: a server restart or a second replica
 * must not silently lose a running job's progress (coordinator note #6).
 */
export type ScrapeJobStatus = "RUNNING" | "DONE" | "ERROR";

/** `FULL` = "Scrape Semua Ulang" (whole listing). `UNIT` = single-unit re-scrape. */
export type ScrapeJobKind = "FULL" | "UNIT";

export type ScrapeJobLogLevel = "INFO" | "WARN" | "ERROR";

export interface ScrapeJobLogEntry {
  readonly level: ScrapeJobLogLevel;
  readonly message: string;
  readonly createdAt: string;
}

/**
 * Real, measured outcome of a finished job. Every field is counted from actual pipeline results —
 * `unitsScraped` from the real parsed session, `photosStored`/`photosFailed` from the real
 * `PhotoBatchResult`s, `unitsPersisted` from the real `scraped_units` write.
 */
export interface ScrapeJobResult {
  readonly unitsScraped: number;
  readonly newUnits: number;
  readonly soldUnits: number;
  readonly photosStored: number;
  readonly photosFailed: number;
  readonly unitsPersisted?: number;
  /** Set for `UNIT` jobs only — the `identityKey` that was re-scraped. */
  readonly unitId?: string;
}

export interface StoredScrapeJob {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: ScrapeJobKind;
  readonly status: ScrapeJobStatus;
  /** Requested target: `unitUrl` for a `UNIT` job, `undefined` for a `FULL` job. */
  readonly unitUrl?: string;
  readonly branch?: string;
  /**
   * Real progress counters. `total` is `undefined` until the listing has actually been parsed —
   * deliberately NOT pre-seeded with a guess, so the dashboard shows an indeterminate state rather
   * than a fabricated denominator.
   */
  readonly progressCurrent: number;
  readonly progressTotal?: number;
  readonly result?: ScrapeJobResult;
  readonly errorMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
