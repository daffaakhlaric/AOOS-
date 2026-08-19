import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SalesHumanRepository } from "./infrastructure/sales-human.repository.js";
import { SalesHumansController } from "./sales-humans.controller.js";
import { SalesHumansService } from "./sales-humans.service.js";
import { SalesController } from "./sales.controller.js";
import { SalesService } from "./sales.service.js";

/**
 * `modules/sales` — personal stats (`SalesController`, pre-existing) + account provisioning
 * (`SalesHumansController`/`SalesHumansService`, AAOS-SALES-MGMT-CRM-AUTH). `SalesHumanRepository`
 * is built from the shared `SUPABASE_CLIENT`, same pattern as `MetaInterestsModule`/
 * `SimulationModule`; `SUPABASE_AUTH_ADMIN` is injected from `AppModule.forRoot`'s global provider
 * set (one Supabase Auth Admin client for the whole app).
 */
@Module({
  controllers: [SalesController, SalesHumansController],
  providers: [
    SalesService,
    SalesHumansService,
    ApiKeyGuard,
    {
      provide: SalesHumanRepository,
      useFactory: (client: SupabaseClientLike): SalesHumanRepository =>
        new SalesHumanRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class SalesModule {}
