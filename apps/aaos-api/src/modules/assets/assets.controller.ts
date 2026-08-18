import { Controller, Delete, Get, HttpCode, Param, Query, UseGuards } from "@nestjs/common";

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
 */
@Controller("api/v1/assets")
@UseGuards(ApiKeyGuard)
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(GetAssetsQuerySchema)) query: GetAssetsQueryDto,
  ): Promise<AssetListResponseDto> {
    return this.service.list(query);
  }

  @Get("stats")
  async stats(): Promise<AssetStatsResponseDto> {
    return this.service.stats();
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
  async archive(@Param("id") id: string): Promise<AssetDto> {
    return this.service.archive(id);
  }
}
