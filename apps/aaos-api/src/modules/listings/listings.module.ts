import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ListingRepository } from "./infrastructure/listing.repository.js";
import { ListingsController } from "./listings.controller.js";
import { ListingsService } from "./listings.service.js";

/**
 * `modules/listings` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 — Listing Manager). Builds
 * `ListingRepository` from the shared `SUPABASE_CLIENT`, same "each module composes its own
 * instance of a shared repository class over one shared connection" pattern `SettingsModule`
 * already establishes. `ListingsService` also injects the globally-provided `ASSET_LIBRARY` token
 * (`AppModule.forRoot`) directly — no separate provider needed here.
 */
@Module({
  controllers: [ListingsController],
  providers: [
    ListingsService,
    ApiKeyGuard,
    {
      provide: ListingRepository,
      useFactory: (client: SupabaseClientLike): ListingRepository => new ListingRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class ListingsModule {}
