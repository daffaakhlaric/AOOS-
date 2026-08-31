import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ActivityLogController } from "./activity-log.controller.js";
import { ActivityLogger } from "./activity-logger.service.js";
import { ActivityRepository } from "./infrastructure/activity.repository.js";

/**
 * `modules/activity-log` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B) — deliberately a SMALL,
 * STANDALONE module, same "small standalone module" precedent `modules/mode-guard` establishes
 * for itself (see that module's own doc): `ActivityLogger`'s real consumers (`MetaAdsModule`,
 * `CampaignsModule`) must never need to import anything beyond this one module to log a real
 * activity row — no circular-import risk. `ActivityRepository` is built here from the shared
 * `SUPABASE_CLIENT`, the same "each module composes its own instance of a shared repository class
 * over one shared connection" pattern `ModeGuardModule`/`SettingsModule` already establish.
 */
@Module({
  controllers: [ActivityLogController],
  providers: [
    ActivityLogger,
    ApiKeyGuard,
    {
      provide: ActivityRepository,
      useFactory: (client: SupabaseClientLike): ActivityRepository =>
        new ActivityRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [ActivityLogger],
})
export class ActivityLogModule {}
