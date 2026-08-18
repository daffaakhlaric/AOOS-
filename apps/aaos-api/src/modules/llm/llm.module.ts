import { TokenBucketRateLimiter, type IRateLimiter } from "@aos/meta-ads-connector";
import { Module } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  LLM_OPENAI_CLIENT,
  LLM_RATE_LIMITER,
  LLM_RESPONSE_CACHE,
} from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ResponseCache } from "./cache/ResponseCache.js";
import { OpenAiClient } from "./infrastructure/OpenAiClient.js";
import { LlmController } from "./llm.controller.js";
import { LlmService } from "./llm.service.js";

const RATE_LIMIT_CAPACITY = 10; // spec Section 6: "Max 10 LLM calls per minute"
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * `LLM_OPENAI_CLIENT`/`LLM_RATE_LIMITER`/`LLM_RESPONSE_CACHE` are provided HERE (module-local),
 * not in `AppModule.forRoot`'s global providers — same precedent as `CreativePackagesModule`'s
 * module-local providers generally: these are implementation details of this one module, not real external
 * integrations shared with other modules, so nothing outside `LlmModule` needs to inject them.
 *
 * `LLM_RATE_LIMITER` reuses `@aos/meta-ads-connector`'s real, tested `TokenBucketRateLimiter`
 * (coordinator note #3) rather than a bespoke implementation — configured for 10 tokens/minute
 * (vs. its Meta-Ads default of 200/hour) via its existing `capacity`/`refillWindowMs` options. One
 * shared instance across `analyze`/`creative-brief`/`chat` — a single process-wide budget, since
 * this app has no per-user identity today (coordinator note #3's "simplest honest
 * interpretation").
 */
@Module({
  controllers: [LlmController],
  providers: [
    LlmService,
    ApiKeyGuard,
    {
      provide: LLM_OPENAI_CLIENT,
      useFactory: (config: AaosApiConfig): OpenAiClient =>
        new OpenAiClient({ apiKey: config.OPENAI_API_KEY }),
      inject: [AAOS_API_CONFIG],
    },
    {
      provide: LLM_RATE_LIMITER,
      useFactory: (): IRateLimiter =>
        new TokenBucketRateLimiter({
          capacity: RATE_LIMIT_CAPACITY,
          refillWindowMs: RATE_LIMIT_WINDOW_MS,
        }),
    },
    {
      provide: LLM_RESPONSE_CACHE,
      useFactory: (): ResponseCache<unknown> => new ResponseCache(),
    },
  ],
  // AAOS-DASHBOARD-SIMULASI addition: `SimulationModule`'s Tamara/Kai pipeline stages call the
  // SAME real `LlmService.analyze`/`creativeBrief` in-process (no self-HTTP-call round trip) —
  // needs `LlmService` exported so `SimulationModule` can import `LlmModule` and inject it.
  exports: [LlmService],
})
export class LlmModule {}
