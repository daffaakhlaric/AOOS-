import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { LeadsController } from "./leads.controller.js";
import { LeadsService } from "./leads.service.js";

/** `LeadsService` is exported (AAOS Overview Monitor Phase O1) so `OverviewModule` can inject the SAME real, tenant-scoped `getLeadsByBranch` this module's own controller already uses — never a second, parallel lead-fetch path. */
@Module({
  controllers: [LeadsController],
  providers: [LeadsService, ApiKeyGuard],
  exports: [LeadsService],
})
export class LeadsModule {}
