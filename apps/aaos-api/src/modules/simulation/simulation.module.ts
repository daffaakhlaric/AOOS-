import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { LearningModule } from "../learning/learning.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaInterestsModule } from "../meta-interests/meta-interests.module.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { SimulationRepository } from "./infrastructure/simulation.repository.js";
import { SimulationController } from "./simulation.controller.js";
import { SimulationService } from "./simulation.service.js";

/**
 * `LlmModule` is imported (not re-provided) so `SimulationService` can inject the SAME real
 * `LlmService` `LlmController`'s own `/api/v1/llm/*` endpoints use — one Samantha implementation,
 * not two (coordinator note #1/#2: call the real thing, never reimplement it).
 *
 * `MetaInterestsModule` is imported for the same reason (AAOS-SIMULASI-TARGETING): the SAMANTHA
 * stage's audience-targeting step reads the real stored `meta_interests` catalogue through the
 * SAME `MetaInterestRepository` `POST /api/v1/meta-interests/sync` writes through — one repository
 * over that table, not a second one composed here.
 *
 * `TenantRepository` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5) is composed the SAME way
 * `SettingsModule` already does — its own instance over the shared `SUPABASE_CLIENT`, not a second
 * lookup mechanism — so `SimulationService.resolveVertical` can read the real per-request tenant's
 * `vertical`.
 *
 * `ListingsModule` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6) is imported (not re-provided,
 * same reasoning as `LlmModule`/`MetaInterestsModule`) so `SimulationService` can inject the real
 * `ListingsService` for Step 3's PROPERTY Kai-prompt preview — the tenant-scoped lookup + its
 * `NotFoundError` authorization stay in one place.
 *
 * `LearningModule` (AAOS Self-Learning AI, Phase B) is imported (not re-provided, same reasoning)
 * so `SimulationService` can inject the real `LearningService` and call
 * `onSimulationComplete(id)` BEST-EFFORT once a run reaches its real terminal state
 * (`repository.complete`) — see `runPipeline`'s own call site for why this can never fail or roll
 * back the simulation itself.
 */
@Module({
  imports: [LlmModule, MetaInterestsModule, ListingsModule, LearningModule],
  controllers: [SimulationController],
  providers: [
    SimulationService,
    ApiKeyGuard,
    {
      provide: SimulationRepository,
      useFactory: (client: SupabaseClientLike): SimulationRepository =>
        new SimulationRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class SimulationModule {}
