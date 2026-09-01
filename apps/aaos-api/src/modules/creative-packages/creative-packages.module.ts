import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { CreativePackagesController } from "./creative-packages.controller.js";
import { CreativePackagesService } from "./creative-packages.service.js";
import { CreativeLogRepository } from "./infrastructure/creative-log.repository.js";
import { CreativePackageRepository } from "./infrastructure/creative-package.repository.js";

/**
 * `modules/creative-packages` (AAOS-CREATIVE-REVIEW) — mirrors `ScraperModule`'s wiring exactly.
 *
 * The old module-local `CREATIVE_PACKAGE_STORE` provider (a process-local in-memory `Map` seeded
 * with 2 fake `cdn.example.com` packages) is GONE: package state now lives in real Supabase tables
 * (`creative_packages`/`creative_logs`, migrations 003/004) reached through the SAME shared
 * `SUPABASE_CLIENT` every other module uses.
 *
 * `KAI_AGENT_RUNTIME`, `ASSET_LIBRARY` and `AAOS_API_CONFIG` are injected from `AppModule.forRoot`'s
 * global provider set — one composed Kai/Kie AI pipeline for the whole app, sharing the same real
 * `IPublisher` as every other package.
 */
@Module({
  imports: [
    // K1/K2 (`docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`) — reuses the SAME real,
    // tenant-scoped `ListingsService.getById` `SimulationModule` already imports this module for
    // (its PROPERTY Kai-prompt preview), not a second listing lookup path.
    ListingsModule,
    // Kai manual-shoot escalation (`docs/PROMPT-AAOS-KAI-MANUAL-SHOOT-MENU-CLEANUP.md`) — the SAME
    // two small, standalone modules `CampaignsModule` already imports for the identical
    // "stamp real mode + write one real `agent_activities` row" purpose. No circular-import risk:
    // both are leaf modules (their own `SUPABASE_CLIENT`-only composition, see each module's own
    // doc) that neither imports `CreativePackagesModule` nor anything that transitively does.
    // `BRANCH_MANAGER` needs no import at all here — it's provided `global: true` by
    // `AppModule.forRoot` (see `CreativePackagesService`'s constructor doc).
    ModeGuardModule,
    ActivityLogModule,
  ],
  controllers: [CreativePackagesController],
  providers: [
    CreativePackagesService,
    ApiKeyGuard,
    {
      provide: CreativePackageRepository,
      useFactory: (client: SupabaseClientLike): CreativePackageRepository =>
        new CreativePackageRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: CreativeLogRepository,
      useFactory: (client: SupabaseClientLike): CreativeLogRepository =>
        new CreativeLogRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  // `CreativePackagesService` is exported so `AbTestingModule` (AAOS-ABTESTING-LOOKALIKE) can
  // inject the SAME real Kai/Kie AI pipeline every manual/Samantha-approved brief already uses to
  // generate each A/B test variant's creative — one creative-generation implementation, not two
  // (coordinator note section 2).
  exports: [CreativePackagesService],
})
export class CreativePackagesModule {}
