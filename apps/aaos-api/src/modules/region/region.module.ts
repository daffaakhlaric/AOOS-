import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { RegionController } from "./region.controller.js";
import { RegionService } from "./region.service.js";

/**
 * `modules/region` (`docs/PROMPT-AAOS-GEO-TARGETING-AND-REGION-PICKER.md` Part B) — the Listing
 * form's real cascading province -> kabupaten/kota -> kecamatan picker backend. No repository, no
 * `SUPABASE_CLIENT` dependency — `RegionService` composes its own in-memory `ResponseCache` and
 * calls the public wilayah catalog directly, same "no DB, no tenant" shape a pure external-data
 * proxy module needs.
 */
@Module({
  controllers: [RegionController],
  providers: [RegionService, ApiKeyGuard],
})
export class RegionModule {}
