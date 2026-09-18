/**
 * EYVRA — SAMANTHA V2 + KAI V2 Phase 22. Client-safe DTO shapes for
 * `GET /api/v1/creative-memory/asset-performance` — mirrors `apps/aaos-api`'s
 * `AssetPerformanceResponseDto`/`AssetPerformanceResult`/`AggregatedMetrics`/`DataSufficiencyResult`
 * field-for-field (Phase 21's Kai V2 Asset Analyzer, one real ranked row per individually-published
 * `creative_packages` asset — never grouped by angle, that's `angle-performance.types.ts`'s job).
 * Hand-written, not imported from `apps/aaos-api`, same "never pull a Node-only runtime value into a
 * `"use client"` bundle" discipline `angle-performance.types.ts`'s own header doc establishes.
 *
 * `AggregatedMetricsDto`/`DataSufficiencyLevelDto`/`DataSufficiencyResultDto` are the SAME real shapes
 * `angle-performance.types.ts` already hand-mirrors from the same shared `aggregate-insights.ts`/
 * `data-sufficiency.ts` domain modules — re-exported here rather than duplicated, since a second,
 * independently-hand-typed copy could silently drift from the real backend shape.
 */
import type { AggregatedMetricsDto, DataSufficiencyResultDto } from "./angle-performance.types";

export type {
  AggregatedMetricsDto,
  DataSufficiencyLevelDto,
  DataSufficiencyResultDto,
} from "./angle-performance.types";

/**
 * One real, individually-published `creative_packages` row (this exact video/images/copy), never
 * grouped by angle.
 */
export interface AssetPerformanceResultDto {
  readonly packageId: string;
  /** The real `PropertyAdAngle` (or vertical-equivalent) enum value this asset was published under. */
  readonly angle: string;
  readonly title: string;
  /** Kai's real decided format (`VIDEO_AND_IMAGES` | `IMAGES_ONLY`). `undefined` for a pre-Sprint-6 row this column predates, or a row generation never actually completed for. */
  readonly decidedFormat?: string;
  readonly fatigueStatus: string;
  readonly hasVideo: boolean;
  readonly imageCount: number;
  readonly aggregated: AggregatedMetricsDto;
  readonly dataSufficiency: DataSufficiencyResultDto;
  /**
   * `1` = best real CPL among assets with `dataSufficiency.level >= "MEDIUM"`. `undefined` for any
   * asset below that bar — reported (never hidden), never force-ranked against a reliable one.
   */
  readonly rank?: number;
}

/**
 * `GET /api/v1/creative-memory/asset-performance` response — a pass-through of the real
 * `AssetPerformanceResponseDto`. The backend's own `rankAssetPerformance` already orders `assets` as
 * ranked-first (real rank ascending), then unranked — no client-side re-sort needed.
 */
export interface AssetPerformanceResponseDto {
  readonly assets: readonly AssetPerformanceResultDto[];
}
