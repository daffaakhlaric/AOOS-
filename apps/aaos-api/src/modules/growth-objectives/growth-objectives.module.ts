import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { GrowthObjectivesController } from "./growth-objectives.controller.js";
import { GrowthObjectivesService } from "./growth-objectives.service.js";
import { GrowthObjectiveRepository } from "./infrastructure/growth-objective.repository.js";

/**
 * `modules/growth-objectives` (EYVRA — SAMANTHA V2, Phase 1 Part A). Builds `GrowthObjectiveRepository`
 * from the shared `SUPABASE_CLIENT` via `useFactory`, same "each module composes its own instance
 * of a shared repository class over one shared connection" pattern `SuperadminModule`'s
 * `TenantRepository` provider establishes.
 */
@Module({
  controllers: [GrowthObjectivesController],
  providers: [
    GrowthObjectivesService,
    ApiKeyGuard,
    {
      provide: GrowthObjectiveRepository,
      useFactory: (client: SupabaseClientLike): GrowthObjectiveRepository =>
        new GrowthObjectiveRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [GrowthObjectivesService],
})
export class GrowthObjectivesModule {}
