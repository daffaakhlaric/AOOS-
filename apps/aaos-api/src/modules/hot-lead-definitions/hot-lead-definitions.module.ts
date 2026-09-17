import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { HotLeadDefinitionsController } from "./hot-lead-definitions.controller.js";
import { HotLeadDefinitionsService } from "./hot-lead-definitions.service.js";
import { HotLeadDefinitionRepository } from "./infrastructure/hot-lead-definition.repository.js";

/**
 * `modules/hot-lead-definitions` (EYVRA — SAMANTHA V2, Phase 1 Part A). Builds
 * `HotLeadDefinitionRepository` from the shared `SUPABASE_CLIENT` via `useFactory`, same pattern
 * `GrowthObjectivesModule`/`SuperadminModule` establish.
 */
@Module({
  controllers: [HotLeadDefinitionsController],
  providers: [
    HotLeadDefinitionsService,
    ApiKeyGuard,
    {
      provide: HotLeadDefinitionRepository,
      useFactory: (client: SupabaseClientLike): HotLeadDefinitionRepository =>
        new HotLeadDefinitionRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [HotLeadDefinitionsService],
})
export class HotLeadDefinitionsModule {}
