import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { RecyclingModule } from "../recycling/recycling.module.js";

import { CalendarEventRepository } from "./infrastructure/calendar-event.repository.js";
import { SchedulerController } from "./scheduler.controller.js";
import { SchedulerService } from "./scheduler.service.js";

/**
 * `modules/scheduler` (AAOS-KALENDER-AKTIVITAS) — mirrors `SimulationModule`/`ScraperModule`'s
 * wiring exactly: a Supabase-backed repository built from the shared `SUPABASE_CLIENT`, with
 * `META_ADS_CONNECTOR`/`MOBIX_SCRAPER_SERVICE`/`OBJECTIVE_ENGINE`/`LEAD_STORE`/`EVENT_PUBLISHER`/
 * `AAOS_API_CONFIG` injected from `AppModule.forRoot`'s global provider set — one composed
 * integration for the whole app, never a second one.
 *
 * `LlmModule` is imported (not re-provided) so `SchedulerService` can inject the SAME real
 * `LlmService` `LlmController`/`SimulationService` already use for `TAMARA_ANALYZE` — one Tamara
 * implementation, not two.
 *
 * `RecyclingModule` is imported (not re-provided) the same way, so `SchedulerService` can inject
 * the SAME real `RecyclingService` `RecyclingController` already uses for `RECYCLING_RUN`
 * (AAOS-LEAD-RECYCLING-BROADCAST, coordinator note section 7) — one recycling implementation, not
 * two.
 *
 * `@nestjs/schedule`'s `ScheduleModule.forRoot()` is registered once, in `app.module.ts`'s
 * `AppModule.forRoot` imports (the composition root every cron-using module ultimately sits
 * under) — not here, to avoid double-registering the scheduler registry if a future module also
 * needs `@Cron`.
 */
@Module({
  imports: [LlmModule, RecyclingModule],
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    ApiKeyGuard,
    {
      provide: CalendarEventRepository,
      useFactory: (client: SupabaseClientLike): CalendarEventRepository =>
        new CalendarEventRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class SchedulerModule {}
