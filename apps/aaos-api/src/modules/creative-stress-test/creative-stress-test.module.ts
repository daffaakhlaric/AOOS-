import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { CreativePackageRepository } from "../creative-packages/infrastructure/creative-package.repository.js";
import { ListingKnowledgeModule } from "../listing-knowledge/listing-knowledge.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativeStressTestController } from "./creative-stress-test.controller.js";
import { CreativeStressTestService } from "./creative-stress-test.service.js";
import { StressTestRunRepository } from "./infrastructure/stress-test-run.repository.js";

/**
 * `modules/creative-stress-test` — real entity/persistence/status-machine/evaluator-registry for
 * buyer-persona/objection stress testing of creatives (Second Boundary: the evaluator registry
 * itself now exists — see `CreativeStressTestService`'s own doc).
 *
 * `CreativePackageRepository` is composed HERE directly from the shared `SUPABASE_CLIENT` — the
 * SAME "each module composes its own instance of a shared repository class over one shared
 * connection" pattern `creative-packages.module.ts` itself establishes for this exact class —
 * rather than importing the whole `CreativePackagesModule` (which pulls in
 * `ActivityLogModule`/`AgentRunsModule`/`AiJudgeModule`/`AuditLogModule`/`ModeGuardModule` that
 * this module has no real use for; only real, tenant-scoped `findById` reads are needed here).
 *
 * `ListingsModule`/`ListingKnowledgeModule`/`LlmModule` ARE imported (their real, exported
 * services are genuinely used): `ListingsService.getById` (LISTING-sourced runs' copy proxy),
 * `ListingKnowledgeService.retrieve` (the Fact Validator's real grounding), `LlmService`'s 3 new
 * evaluator methods.
 *
 * Deliberately imports/reuses NOTHING from `modules/simulation` or `modules/go-live` — separate
 * feature, separate table (`stress_test_runs`, not `simulations`), per this module's explicit
 * naming-collision warning.
 */
@Module({
  imports: [LlmModule, ListingsModule, ListingKnowledgeModule],
  controllers: [CreativeStressTestController],
  providers: [
    CreativeStressTestService,
    ApiKeyGuard,
    {
      provide: StressTestRunRepository,
      useFactory: (client: SupabaseClientLike): StressTestRunRepository =>
        new StressTestRunRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: CreativePackageRepository,
      useFactory: (client: SupabaseClientLike): CreativePackageRepository =>
        new CreativePackageRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class CreativeStressTestModule {}
