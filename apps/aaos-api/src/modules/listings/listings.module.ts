import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaOAuthModule } from "../meta-oauth/meta-oauth.module.js";

import { ListingRepository } from "./infrastructure/listing.repository.js";
import { ListingsController } from "./listings.controller.js";
import { ListingsService } from "./listings.service.js";
import { MetaLeadDestinationsService } from "./meta-lead-destinations.service.js";

/**
 * `modules/listings` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 — Listing Manager). Builds
 * `ListingRepository` from the shared `SUPABASE_CLIENT`, same "each module composes its own
 * instance of a shared repository class over one shared connection" pattern `SettingsModule`
 * already establishes. `ListingsService` also injects the globally-provided `ASSET_LIBRARY` token
 * (`AppModule.forRoot`) directly — no separate provider needed here.
 */
@Module({
  imports: [MetaOAuthModule],
  controllers: [ListingsController],
  providers: [
    ListingsService,
    MetaLeadDestinationsService,
    ApiKeyGuard,
    {
      provide: ListingRepository,
      useFactory: (client: SupabaseClientLike): ListingRepository => new ListingRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — `SimulationModule` imports this module to reuse
  // the SAME real `ListingsService.getById` (tenant-scoped `NotFoundError` authorization included)
  // for Step 3's PROPERTY Kai-prompt preview, rather than composing a second listing lookup path.
  exports: [ListingsService, MetaLeadDestinationsService],
})
export class ListingsModule {}
