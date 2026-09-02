import { Controller, Delete, Get, HttpCode, Param, Query, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AssetsService } from "./assets.service.js";
import {
  DownloadQuerySchema,
  GetAssetsQuerySchema,
  type AssetDownloadResponseDto,
  type AssetDto,
  type AssetListResponseDto,
  type AssetStatsResponseDto,
  type DownloadQueryDto,
  type GetAssetsQueryDto,
} from "./dto/assets.dto.js";

/**
 * `GET/DELETE /api/v1/assets*` — `x-api-key` auth (same discipline as `SimulationController`).
 *
 * `stats` is declared before `:id` so `GET /api/v1/assets/stats` is never swallowed by the `:id`
 * route, and `:id/download` before `:id` for the same reason.
 *
 * `POST /api/v1/assets/upload` (the spec's "Upload Manual") is deliberately NOT implemented — see
 * `docs/REPORT-AAOS-SCRAPER-ASSET-LIBRARY.md`: this app runs on `@nestjs/platform-fastify` with no
 * multipart parser registered, and inventing a base64-JSON upload contract instead of the spec's
 * `multipart/form-data` would be a fabricated API surface. The dashboard has no Upload button.
 *
 * TENANT-SCOPING FIX (Phase T1, docs/PROMPT-AAOS-TENANT-SCOPING-AND-PROPERTY-OBJECTIVE.md Finding 1):
 * `list`/`stats`/`archive` now resolve the real per-request tenant via `@TenantId()`
 * (`common/tenant-context.ts` — the SAME `LeadsController` convention) and thread it into
 * `AssetsService`, instead of the service reading the single, process-wide `AAOS_TENANT_ID` env var.
 * `byId`/`download` are left as-is: `GetAsset`'s use case in `@aos/asset-library` never accepted a
 * tenantId to begin with (verified directly), so there is no `config.AAOS_TENANT_ID` read to relocate
 * there — closing that separate gap would mean changing the use case's contract in the shared package,
 * out of scope for this phase.
 */
@Controller("api/v1/assets")
@UseGuards(ApiKeyGuard)
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(GetAssetsQuerySchema)) query: GetAssetsQueryDto,
    @TenantId() tenantId: string,
  ): Promise<AssetListResponseDto> {
    return this.service.list(query, tenantId);
  }

  @Get("stats")
  async stats(@TenantId() tenantId: string): Promise<AssetStatsResponseDto> {
    return this.service.stats(tenantId);
  }

  @Get(":id/download")
  async download(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(DownloadQuerySchema)) query: DownloadQueryDto,
  ): Promise<AssetDownloadResponseDto> {
    return this.service.downloadUrl(id, query);
  }

  @Get(":id")
  async byId(@Param("id") id: string): Promise<AssetDto> {
    return this.service.byId(id);
  }

  /**
   * SOFT delete: archives the asset (`AssetStatus.ARCHIVED`), keeping the row and the GCS object.
   * There is no hard delete anywhere in this domain — `IAssetRepository` has no `delete` method.
   * Returns the updated asset so the client can see the new status, rather than a bare
   * `{ deleted: true }` that would misrepresent what happened.
   */
  @Delete(":id")
  @HttpCode(200)
  async archive(@Param("id") id: string, @TenantId() tenantId: string): Promise<AssetDto> {
    return this.service.archive(id, tenantId);
  }
}
