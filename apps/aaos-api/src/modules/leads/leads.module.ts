import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { LeadsController } from "./leads.controller.js";
import { LeadsService } from "./leads.service.js";

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, ApiKeyGuard],
})
export class LeadsModule {}
