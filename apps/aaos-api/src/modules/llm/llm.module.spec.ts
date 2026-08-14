import "reflect-metadata";

import type { IRateLimiter } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import {
  AAOS_API_CONFIG,
  LLM_OPENAI_CLIENT,
  LLM_RATE_LIMITER,
  LLM_RESPONSE_CACHE,
} from "../../di-tokens.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { ResponseCache } from "./cache/ResponseCache.js";
import { OpenAiClient } from "./infrastructure/OpenAiClient.js";
import { LlmController } from "./llm.controller.js";
import { LlmModule } from "./llm.module.js";
import { LlmService } from "./llm.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("LlmModule", () => {
  it("registers LlmController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", LlmModule) as unknown[];
    expect(metadata).toEqual([LlmController]);
  });

  it("registers LlmService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", LlmModule) as unknown[];
    expect(metadata).toContain(LlmService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("provides LLM_OPENAI_CLIENT via a useFactory built from AAOS_API_CONFIG.OPENAI_API_KEY", () => {
    const metadata = Reflect.getMetadata("providers", LlmModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === LLM_OPENAI_CLIENT);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([AAOS_API_CONFIG]);
    const client = provider?.useFactory?.(buildTestConfig({ OPENAI_API_KEY: "sk-test" }) as never);
    expect(client).toBeInstanceOf(OpenAiClient);
  });

  it("provides LLM_RATE_LIMITER via a useFactory returning a working IRateLimiter", () => {
    const metadata = Reflect.getMetadata("providers", LlmModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === LLM_RATE_LIMITER);
    expect(provider).toBeDefined();
    const limiter = provider?.useFactory?.() as IRateLimiter;
    expect(limiter.tryConsume().ok).toBe(true);
    expect(limiter.getRateLimitStatus().remaining).toBeLessThanOrEqual(10);
  });

  it("provides LLM_RESPONSE_CACHE via a useFactory returning a ResponseCache", () => {
    const metadata = Reflect.getMetadata("providers", LlmModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === LLM_RESPONSE_CACHE);
    expect(provider).toBeDefined();
    const cache = provider?.useFactory?.() as ResponseCache<unknown>;
    cache.set("analyze", { a: 1 }, "value");
    expect(cache.get("analyze", { a: 1 })).toBe("value");
  });
});
