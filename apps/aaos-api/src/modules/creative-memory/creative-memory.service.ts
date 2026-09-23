import { Injectable } from "@nestjs/common";

import type { WindowDateRange } from "../metric-snapshot/domain/metric-window.js";

import { rankAnglePerformance, type PackagePerformanceInput } from "./domain/angle-performance.js";
import { rankAssetPerformance, type AssetPerformanceInput } from "./domain/asset-performance.js";
import type { AnglePerformanceResponseDto } from "./dto/angle-performance.dto.js";
import type { AssetPerformanceResponseDto } from "./dto/asset-performance.dto.js";
import { CreativeMemoryRepository } from "./infrastructure/creative-memory.repository.js";

/**
 * `modules/creative-memory` (EYVRA — SAMANTHA V2 + KAI V2 Phase 2, Creative Performance Memory).
 * Orchestrates: list this tenant's real published PROPERTY `creative_packages` -> resolve each
 * one's own real linked Meta ad performance -> `rankAnglePerformance` (pure domain function, no
 * I/O). A 100% read-only aggregation over already-persisted rows — never touches the real KIE.ai
 * generation pipeline (`packages/creative-connector`/`creative-agent`) or writes to any of the
 * three tables it reads.
 */
@Injectable()
export class CreativeMemoryService {
  constructor(private readonly repository: CreativeMemoryRepository) {}

  /**
   * AAOS Command Center creative thumbnails — real Kai lineage, keyed by Meta ad id:
   * `meta_ad_id -> {creativePackageId, assetUrl?}`, built from the ONE real persisted link this
   * codebase has (`creative_packages.published_meta_ad_ids`, see
   * `CreativeMemoryRepository.listPublishedPackageLineage`). One tenant-scoped read, pure reshaping
   * after it.
   *
   * `assetUrl` is the package's real generated GCS URL — `video_url` when the package produced a
   * video, otherwise its first `image_urls` entry. Absent when the package genuinely has neither
   * yet (generation incomplete/failed). This is the KAI-side asset, deliberately distinct from the
   * Meta-side thumbnail URL: the same creative exists in both places, and the UI uses the Kai URL
   * to link back to the package, never as the thumbnail itself.
   *
   * When one Meta ad id somehow appears under two packages (possible in principle — nothing
   * enforces exclusivity on a JSONB array), the FIRST row wins and the duplicate is ignored rather
   * than guessed at.
   */
  async getKaiLineageByMetaAdId(
    tenantId: string,
  ): Promise<
    ReadonlyMap<string, { readonly creativePackageId: string; readonly assetUrl?: string }>
  > {
    const rows = await this.repository.listPublishedPackageLineage(tenantId);
    const byMetaAdId = new Map<
      string,
      { readonly creativePackageId: string; readonly assetUrl?: string }
    >();
    for (const row of rows) {
      const assetUrl = row.videoUrl ?? row.imageUrls[0];
      for (const metaAdId of row.publishedMetaAdIds) {
        if (metaAdId.length === 0 || byMetaAdId.has(metaAdId)) {
          continue;
        }
        byMetaAdId.set(metaAdId, {
          creativePackageId: row.id,
          ...(assetUrl !== undefined && assetUrl.length > 0 ? { assetUrl } : {}),
        });
      }
    }
    return byMetaAdId;
  }

  async getAnglePerformance(
    tenantId: string,
    window?: WindowDateRange,
  ): Promise<AnglePerformanceResponseDto> {
    const packages = await this.repository.listPublishedPropertyPackages(tenantId);
    if (packages.length === 0) {
      return { angles: [] };
    }

    const inputs: PackagePerformanceInput[] = [];
    for (const pkg of packages) {
      // N+1 across this tenant's own small number of published packages — accepted MVP-scale
      // tradeoff, same one `CreativeMemoryRepository.getAdInsightRows`'s own doc documents for its
      // per-`meta_ad_id` loop.
      const insightRows = await this.repository.getAdInsightRows(
        tenantId,
        pkg.publishedMetaAdIds,
        window,
      );
      inputs.push({ angle: pkg.angle, insightRows });
    }

    return { angles: rankAnglePerformance(inputs) };
  }

  /**
   * Kai V2 Asset Analyzer (Phase 21) — the individual-asset sibling of `getAnglePerformance`. Same
   * real orchestration shape (list published PROPERTY assets -> resolve each one's own real linked
   * Meta ad performance -> pure domain ranking, no I/O in the domain layer), applied at
   * one-row-per-real-generated-asset granularity instead of grouped by angle — see
   * `domain/asset-performance.ts`'s own doc for why this is a genuinely different, additive view
   * rather than a duplicate of `getAnglePerformance`.
   */
  async getAssetPerformance(
    tenantId: string,
    window?: WindowDateRange,
  ): Promise<AssetPerformanceResponseDto> {
    const assets = await this.repository.listPublishedPropertyAssets(tenantId);
    if (assets.length === 0) {
      return { assets: [] };
    }

    const inputs: AssetPerformanceInput[] = [];
    for (const asset of assets) {
      // Same accepted N+1 MVP-scale tradeoff `getAnglePerformance` above already documents.
      const insightRows = await this.repository.getAdInsightRows(
        tenantId,
        asset.publishedMetaAdIds,
        window,
      );
      inputs.push({
        packageId: asset.id,
        angle: asset.angle,
        title: asset.title,
        ...(asset.decidedFormat !== undefined ? { decidedFormat: asset.decidedFormat } : {}),
        fatigueStatus: asset.fatigueStatus,
        hasVideo: asset.hasVideo,
        imageCount: asset.imageCount,
        insightRows,
      });
    }

    return { assets: rankAssetPerformance(inputs) };
  }
}
