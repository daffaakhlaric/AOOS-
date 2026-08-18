import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AssetsController } from "./assets.controller.js";
import { AssetsService } from "./assets.service.js";

/**
 * `modules/assets` (AAOS-SCRAPER-ASSET-LIBRARY).
 *
 * No repository provider of its own: unlike `modules/scraper`'s `scrape_jobs` tables, everything this
 * module persists lives behind `@aos/asset-library`'s already-composed `AssetRepository`, reached
 * through the `ASSET_LIBRARY` token `AppModule.forRoot` provides globally.
 */
@Module({
  controllers: [AssetsController],
  providers: [AssetsService, ApiKeyGuard],
})
export class AssetsModule {}
