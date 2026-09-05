import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaAdsModule } from "../meta-ads/meta-ads.module.js";

import { AuditLogController } from "./audit-log.controller.js";
import { AuditLogService } from "./audit-log.service.js";
import { AuditLogRepository } from "./infrastructure/audit-log.repository.js";

/**
 * `modules/audit-log` (AAOS LOOP UPGRADE, Sprint 6 Prompt 17) — `MetaAdsModule` is imported (not
 * re-provided, `exports: [MetaAdsService]`) so `AuditLogService.rollback` can inject the SAME real
 * `MetaAdsService.executeVerdict` every other real Meta-mutating caller in this app uses — never a
 * second, parallel execution path. Other real consumers (`PendingActionsModule`,
 * `SchedulerModule`) import this module directly to inject the exported `AuditLogService` for their
 * own real writer call sites (same "each real consumer imports the small standalone module
 * directly" pattern `PendingActionsModule`'s own doc establishes).
 */
@Module({
  imports: [MetaAdsModule],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    ApiKeyGuard,
    {
      provide: AuditLogRepository,
      useFactory: (client: SupabaseClientLike): AuditLogRepository =>
        new AuditLogRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
