import { AssetStatus, AssetType, type Asset, type AssetStats } from "@aos/asset-library";
import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

/** `GET /api/v1/assets?type=&status=&branch=&unitId=&model=&search=&page=&limit=&sort=` */
export const GetAssetsQuerySchema = z.object({
  // `z.nativeEnum` means only the REAL enum members are accepted — the spec's `?type=all` sentinel
  // is expressed by simply omitting the parameter, never by a fabricated "ALL" enum member.
  type: z.nativeEnum(AssetType).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  branch: z.nativeEnum(Branch).optional(),
  unitId: z.string().trim().min(1).optional(),
  // AAOS-CREATIVE-REVIEW: case-insensitive substring match against the REAL, scraper-populated
  // `unit_model` column — what the creative photo picker filters on ("xpander"/"hrv"/"avanza").
  // Deliberately a free-text string, not an enum: there is no closed list of unit models anywhere
  // in this codebase, and inventing one would reject real models the scraper genuinely persists.
  model: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  // CREATIVE HUB — the honest "Manual/Upload" vs "Kai" split. Only these two real values are
  // accepted; the spec's fabricated "Meta"/"Imported" buckets have no real backing data anywhere
  // in this codebase (see `AssetListFilter.source`'s doc in `@aos/asset-library`).
  source: z.enum(["MANUAL", "KAI"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(48),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});
export type GetAssetsQueryDto = z.infer<typeof GetAssetsQuerySchema>;

/** `GET /api/v1/assets/:id/download?expiresIn=` — seconds, capped at 24h. */
export const DownloadQuerySchema = z.object({
  expiresIn: z.coerce.number().int().positive().max(86_400).default(3600),
});
export type DownloadQueryDto = z.infer<typeof DownloadQuerySchema>;

/**
 * One asset as the dashboard sees it. Every field maps 1:1 to a real `Asset` entity getter — there
 * is deliberately no `width`/`height`/`durationSeconds`/`isMainPhoto`/`usedInPackages`/`source`
 * here: nothing in this codebase produces any of them today, and the Asset Library UI omits them
 * rather than showing a fabricated value (see the report doc's "cut from scope" section).
 */
export interface AssetDto {
  readonly id: string;
  readonly type: AssetType;
  readonly status: AssetStatus;
  readonly storagePath: string;
  readonly publicUrl: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly tags: readonly string[];
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitYear?: number;
  readonly branch?: string;
  readonly aiPrompt?: string;
  readonly aiModel?: string;
  readonly creativeBriefId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AssetListResponseDto {
  readonly assets: readonly AssetDto[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface AssetStatsResponseDto {
  readonly totalAssets: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly byBranch: Readonly<Record<string, number>>;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly totalSizeBytes: number;
  /** CREATIVE HUB — real "Manual/Upload" vs "Kai" counts (see `GetAssetsQuerySchema.source`'s doc). */
  readonly bySource: Readonly<{ MANUAL: number; KAI: number }>;
}

export interface AssetDownloadResponseDto {
  readonly url: string;
  readonly expiresInSeconds: number;
}

export function toAssetDto(asset: Asset): AssetDto {
  return {
    id: asset.id.toString(),
    type: asset.type,
    status: asset.status,
    storagePath: asset.storagePath.toString(),
    publicUrl: asset.publicUrl.toString(),
    fileName: asset.fileName,
    mimeType: asset.mimeType.toString(),
    fileSize: asset.fileSize.bytes,
    tags: asset.tags.map((tag) => tag.toString()),
    ...(asset.unitId !== undefined ? { unitId: asset.unitId } : {}),
    ...(asset.unitModel !== undefined ? { unitModel: asset.unitModel } : {}),
    ...(asset.unitYear !== undefined ? { unitYear: asset.unitYear } : {}),
    ...(asset.branch !== undefined ? { branch: asset.branch } : {}),
    ...(asset.aiPrompt !== undefined ? { aiPrompt: asset.aiPrompt } : {}),
    ...(asset.aiModel !== undefined ? { aiModel: asset.aiModel } : {}),
    ...(asset.creativeBriefId !== undefined ? { creativeBriefId: asset.creativeBriefId } : {}),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export function toAssetStatsResponseDto(stats: AssetStats): AssetStatsResponseDto {
  return {
    totalAssets: stats.totalAssets,
    byType: stats.byType,
    byBranch: stats.byBranch,
    byStatus: stats.byStatus,
    totalSizeBytes: stats.totalSizeBytes,
    bySource: stats.bySource,
  };
}
