import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativeMemoryController } from "./creative-memory.controller.js";
import { CreativeMemoryService } from "./creative-memory.service.js";
import { CreativeMemoryRepository } from "./infrastructure/creative-memory.repository.js";

/**
 * `modules/creative-memory` (EYVRA — SAMANTHA V2 + KAI V2 Phase 2, Creative Performance Memory).
 * Builds `CreativeMemoryRepository` from the shared `SUPABASE_CLIENT` via `useFactory` — same
 * "each module composes its own instance of a shared repository class over one shared connection"
 * pattern `MetricSnapshotModule`/`GrowthObjectivesModule`/`HotLeadDefinitionsModule` already
 * establish.
 *
 * Deliberately does NOT import `CreativePackagesModule` even though it reads `creative_packages`:
 * that module's `CreativePackagesService` is tenant-scoped via the older static `AAOS_TENANT_ID`
 * config value, not the newer per-request `@TenantId()` convention this module (and every Phase 1
 * module) uses. Reading the table directly through its own repository keeps this module's tenant
 * scoping consistent with the rest of EYVRA — SAMANTHA V2, at the cost of a second read path over
 * the same table (an accepted, documented tradeoff — never writes to it).
 */
@Module({
  controllers: [CreativeMemoryController],
  providers: [
    CreativeMemoryService,
    ApiKeyGuard,
    {
      provide: CreativeMemoryRepository,
      useFactory: (client: SupabaseClientLike): CreativeMemoryRepository =>
        new CreativeMemoryRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [CreativeMemoryService],
})
export class CreativeMemoryModule {}
