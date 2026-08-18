import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ScrapeJobRepository } from "./infrastructure/scrape-job.repository.js";
import { ScraperController } from "./scraper.controller.js";
import { ScraperService } from "./scraper.service.js";

/**
 * `modules/scraper` (AAOS-SCRAPER-ASSET-LIBRARY) — mirrors `SimulationModule`'s wiring exactly.
 *
 * `MOBIX_SCRAPER_SERVICE` and `AAOS_API_CONFIG` are injected from `AppModule.forRoot`'s global
 * provider set (not re-provided here): one composed `@aos/mobix-web-scraper` service for the whole
 * app, sharing the same real `IPublisher` as every other package.
 */
@Module({
  controllers: [ScraperController],
  providers: [
    ScraperService,
    ApiKeyGuard,
    {
      provide: ScrapeJobRepository,
      useFactory: (client: SupabaseClientLike): ScrapeJobRepository =>
        new ScrapeJobRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class ScraperModule {}
