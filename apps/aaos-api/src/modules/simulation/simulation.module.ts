import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaInterestsModule } from "../meta-interests/meta-interests.module.js";

import { SimulationRepository } from "./infrastructure/simulation.repository.js";
import { SimulationController } from "./simulation.controller.js";
import { SimulationService } from "./simulation.service.js";

/**
 * `LlmModule` is imported (not re-provided) so `SimulationService` can inject the SAME real
 * `LlmService` `LlmController`'s own `/api/v1/llm/*` endpoints use — one Tamara implementation,
 * not two (coordinator note #1/#2: call the real thing, never reimplement it).
 *
 * `MetaInterestsModule` is imported for the same reason (AAOS-SIMULASI-TARGETING): the TAMARA
 * stage's audience-targeting step reads the real stored `meta_interests` catalogue through the
 * SAME `MetaInterestRepository` `POST /api/v1/meta-interests/sync` writes through — one repository
 * over that table, not a second one composed here.
 */
@Module({
  imports: [LlmModule, MetaInterestsModule],
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
  ],
})
export class SimulationModule {}
