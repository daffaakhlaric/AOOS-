import { Module } from "@nestjs/common";

import { LlmModule } from "../llm/llm.module.js";

import { LocationResolverService } from "./location-resolver.service.js";

/**
 * `modules/location-resolver` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 1). Imports
 * `LlmModule` (not re-provided) so `LocationResolverService` injects the SAME real `LlmService`
 * every other LLM-backed feature this session uses — one Samantha/OpenAI composition, never a
 * second one — same "import, don't re-provide" precedent `SchedulerModule` already establishes for
 * `LlmModule`/`RecyclingModule`/etc.
 */
@Module({
  imports: [LlmModule],
  providers: [LocationResolverService],
  exports: [LocationResolverService],
})
export class LocationResolverModule {}
