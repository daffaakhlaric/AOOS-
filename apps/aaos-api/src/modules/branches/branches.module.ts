import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { BranchesController } from "./branches.controller.js";
import { BranchesService } from "./branches.service.js";

/** Mirrors `LeadsModule`: `BRANCH_MANAGER`/`AAOS_API_CONFIG` are provided globally by `AppModule.forRoot` (see that file's composition of `@aos/branch-manager` via `BranchManagerFactory`). */
@Module({
  controllers: [BranchesController],
  providers: [BranchesService, ApiKeyGuard],
})
export class BranchesModule {}
