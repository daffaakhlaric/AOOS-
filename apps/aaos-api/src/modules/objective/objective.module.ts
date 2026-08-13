import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ObjectiveController } from "./objective.controller.js";
import { ObjectiveService } from "./objective.service.js";

/** Mirrors `LeadsModule`: `OBJECTIVE_ENGINE`/`AAOS_API_CONFIG` are provided globally by `AppModule.forRoot` (see that file's composition of `@aos/objective-engine` via `ObjectiveEngineFactory`), so this module only needs to declare its own controller/service. */
@Module({
  controllers: [ObjectiveController],
  providers: [ObjectiveService, ApiKeyGuard],
})
export class ObjectiveModule {}
