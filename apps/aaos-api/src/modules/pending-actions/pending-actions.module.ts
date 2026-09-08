import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AuditLogModule } from "../audit-log/audit-log.module.js";
import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { CreativePackagesModule } from "../creative-packages/creative-packages.module.js";
import { CreativePackageRepository } from "../creative-packages/infrastructure/creative-package.repository.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { PendingActionRepository } from "./infrastructure/pending-action.repository.js";
import { PendingActionsController } from "./pending-actions.controller.js";
import { PendingActionsService } from "./pending-actions.service.js";

/**
 * `modules/pending-actions` (AAOS-OPERATING-MODE-APPROVAL-GATE) — `CampaignsModule` is imported
 * (not re-provided, `exports: [CampaignsService]`) so `PendingActionsService.approve` can inject
 * the SAME real `CampaignsService.createPropertyCampaign` `CampaignsController`'s manual endpoint
 * and `SchedulerService`'s `FULL_CONTROL`-mode path already use — never a second, parallel
 * campaign-creation code path. No circular-import risk: `CampaignsModule` only imports
 * `ModeGuardModule`/`ActivityLogModule`/`ListingsModule`/`LocationResolverModule` (verified directly
 * — none of them import this module back).
 *
 * `SchedulerModule` imports this module directly (same "each real consumer imports the small
 * standalone module directly" pattern `RecyclingModule`/`AbTestingModule` already establish) so
 * `SchedulerService.recordCampaignTriggerDecision` can inject the exported `PendingActionsService`
 * for its own real `enqueue()` write path when a tenant's `operating_mode` is `APPROVAL`.
 */
@Module({
  imports: [
    CampaignsModule,
    AuditLogModule,
    ModeGuardModule,
    // AAOS LOOP UPGRADE, Sprint 8b (Prompt 19 Step 4) — so PendingActionsService can inject the
    // exported CreativePackagesService for its own real `triggerAutoLoopGeneration` auto-trigger
    // call, fired right after a human approves a REVIEW_CREATIVE_BRIEF row (`approve`'s
    // `REVIEW_CREATIVE_BRIEF` branch — see that method's own doc). No circular-import risk:
    // `CreativePackagesModule`'s own import graph does not import `PendingActionsModule` (verified
    // directly, same investigation `SchedulerModule`'s own doc documents for its own import of this
    // same module).
    CreativePackagesModule,
  ],
  controllers: [PendingActionsController],
  providers: [
    PendingActionsService,
    ApiKeyGuard,
    {
      provide: PendingActionRepository,
      useFactory: (client: SupabaseClientLike): PendingActionRepository =>
        new PendingActionRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    // AAOS LOOP UPGRADE, Sprint 8a — real `REVIEW_CREATIVE_BRIEF` approve/reject writer dependency.
    // Provided directly (not via `CreativePackagesModule`), the SAME "leaf repository, no extra
    // module graph" pattern `SchedulerModule` already establishes for this exact repository.
    {
      provide: CreativePackageRepository,
      useFactory: (client: SupabaseClientLike): CreativePackageRepository =>
        new CreativePackageRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [PendingActionsService],
})
export class PendingActionsModule {}
