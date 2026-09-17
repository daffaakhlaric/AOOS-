import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { MetricSnapshotRepository } from "./infrastructure/metric-snapshot.repository.js";
import { MetricSnapshotController } from "./metric-snapshot.controller.js";
import { MetricSnapshotService } from "./metric-snapshot.service.js";

/**
 * `modules/metric-snapshot` (EYVRA — SAMANTHA V2 Phase 1 Part B, first half). Builds
 * `MetricSnapshotRepository` from the shared `SUPABASE_CLIENT` via `useFactory` — same
 * "each module composes its own instance of a shared repository class over one shared connection"
 * pattern `GrowthObjectivesModule`/`HotLeadDefinitionsModule` already establish.
 */
@Module({
  controllers: [MetricSnapshotController],
  providers: [
    MetricSnapshotService,
    ApiKeyGuard,
    {
      provide: MetricSnapshotRepository,
      useFactory: (client: SupabaseClientLike): MetricSnapshotRepository =>
        new MetricSnapshotRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [MetricSnapshotService],
})
export class MetricSnapshotModule {}
