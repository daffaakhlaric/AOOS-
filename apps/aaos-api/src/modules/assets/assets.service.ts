import { randomUUID } from "node:crypto";

import type { AssetLibrary } from "@aos/asset-library";
import { UnavailableError } from "@aos/errors";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, ASSET_LIBRARY } from "../../di-tokens.js";

import {
  toAssetDto,
  toAssetStatsResponseDto,
  type AssetDownloadResponseDto,
  type AssetDto,
  type AssetListResponseDto,
  type AssetStatsResponseDto,
  type DownloadQueryDto,
  type GetAssetsQueryDto,
} from "./dto/assets.dto.js";

/**
 * Backs `/api/v1/assets*` (AAOS-SCRAPER-ASSET-LIBRARY) — the first real `aaos-api` integration of
 * `@aos/asset-library`.
 *
 * Every method goes through the library's own real use cases (`ListAssets`, `GetAssetStats`,
 * `GetAsset`, `ArchiveAsset`) and its `IAssetStorage.getSignedUrl` — nothing here reimplements
 * asset querying or reaches into another package's internals.
 *
 * GRACEFUL DEGRADATION: `ASSET_LIBRARY` resolves to `undefined` when this deployment has no GCS
 * configured (see `di-tokens.ts` / `to-asset-library-config.ts`), because `GcsStorageClient`'s
 * constructor throws without credentials and composing it unconditionally would take the whole API
 * down. In that state every endpoint here raises `UnavailableError` → HTTP 503 with a message naming
 * the missing env vars — never an empty asset list, which would look identical to "the library is
 * genuinely empty".
 *
 * NO HARD DELETE: `archive()` calls the library's real `ArchiveAsset` use case, which sets
 * `AssetStatus.ARCHIVED` and deliberately keeps both the row and the GCS object ("keep for
 * history"). `IAssetRepository` has no `delete` method and this service does not invent one; the
 * dashboard labels the action "Arsipkan", not "Hapus permanen".
 */
@Injectable()
export class AssetsService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(ASSET_LIBRARY) private readonly assetLibrary: AssetLibrary | undefined,
  ) {}

  private requireLibrary(): AssetLibrary {
    if (this.assetLibrary === undefined) {
      throw new UnavailableError(
        "Asset library is not configured on this deployment — set GCS_PROJECT_ID and one of " +
          "GCS_CREDENTIALS / GCS_KEY_FILE_PATH to enable /api/v1/assets.",
      );
    }
    return this.assetLibrary;
  }

  async list(query: GetAssetsQueryDto): Promise<AssetListResponseDto> {
    const library = this.requireLibrary();
    const result = await library.listAssets.execute({
      tenantId: this.config.AAOS_TENANT_ID,
      ...(query.type !== undefined ? { type: query.type } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.branch !== undefined ? { branch: query.branch } : {}),
      ...(query.unitId !== undefined ? { unitId: query.unitId } : {}),
      ...(query.search !== undefined ? { search: query.search } : {}),
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    });
    if (!result.ok) {
      throw result.error;
    }
    return {
      assets: result.value.assets.map(toAssetDto),
      total: result.value.total,
      page: result.value.page,
      limit: result.value.limit,
    };
  }

  async stats(): Promise<AssetStatsResponseDto> {
    const library = this.requireLibrary();
    const result = await library.getAssetStats.execute({
      tenantId: this.config.AAOS_TENANT_ID,
    });
    if (!result.ok) {
      throw result.error;
    }
    return toAssetStatsResponseDto(result.value);
  }

  async byId(id: string): Promise<AssetDto> {
    const library = this.requireLibrary();
    const result = await library.getAsset.execute(id);
    if (!result.ok) {
      // `AssetNotFoundError` carries `ErrorCode.NOT_FOUND`, which `AaosExceptionFilter` maps to 404
      // via its generic `AosError` branch — no HTTP status is computed here.
      throw result.error;
    }
    return toAssetDto(result.value);
  }

  /** Soft delete — see this class's "NO HARD DELETE" doc note. */
  async archive(id: string): Promise<AssetDto> {
    const library = this.requireLibrary();
    const result = await library.archiveAsset.execute({
      id,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId: randomUUID(),
    });
    if (!result.ok) {
      throw result.error;
    }
    return toAssetDto(result.value);
  }

  /**
   * A real, time-limited GCS V4 signed read URL. Returned as JSON rather than as a 302 redirect (the
   * original spec's suggestion) so the dashboard's own server-side proxy route can hand the URL to
   * the browser without the browser ever having to follow a redirect chain through an API-key-guarded
   * endpoint.
   */
  async downloadUrl(id: string, query: DownloadQueryDto): Promise<AssetDownloadResponseDto> {
    const library = this.requireLibrary();
    const found = await library.getAsset.execute(id);
    if (!found.ok) {
      throw found.error;
    }
    const signed = await library.assetStorage.getSignedUrl(
      found.value.storagePath.toString(),
      query.expiresIn,
    );
    if (!signed.ok) {
      throw signed.error;
    }
    return { url: signed.value, expiresInSeconds: query.expiresIn };
  }
}
