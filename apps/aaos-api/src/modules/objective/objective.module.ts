import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ObjectiveController } from "./objective.controller.js";
import { ObjectiveService } from "./objective.service.js";

/** Mirrors `LeadsModule`: `OBJECTIVE_ENGINE`/`AAOS_API_CONFIG` are provided globally by `AppModule.forRoot` (see that file's composition of `@aos/objective-engine` via `ObjectiveEngineFactory`), so this module only needs to declare its own controller/service. */
/** `ObjectiveService` is exported (AAOS Overview Monitor Phase O1) so `OverviewModule` can inject the SAME real `getCurrentObjective` this module's own controller already uses — never a second, parallel objective read path. */
@Module({
  controllers: [ObjectiveController],
  providers: [ObjectiveService, ApiKeyGuard],
  exports: [ObjectiveService],
})
export class ObjectiveModule {}
