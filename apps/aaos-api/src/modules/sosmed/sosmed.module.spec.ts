import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ScheduledPostRepository } from "./infrastructure/scheduled-post.repository.js";
import { SosmedController } from "./sosmed.controller.js";
import { SosmedModule } from "./sosmed.module.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("SosmedModule", () => {
  it("registers SosmedController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", SosmedModule) as unknown[];
    expect(metadata).toEqual([SosmedController]);
  });

  it("imports LlmModule so SosmedController injects the real shared LlmService", () => {
    const metadata = Reflect.getMetadata("imports", SosmedModule) as unknown[];
    expect(metadata).toContain(LlmModule);
  });

  it("registers ApiKeyGuard as a provider", () => {
    const metadata = Reflect.getMetadata("providers", SosmedModule) as unknown[];
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("provides ScheduledPostRepository from the SHARED SUPABASE_CLIENT (not a second connection)", () => {
    const metadata = Reflect.getMetadata("providers", SosmedModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === ScheduledPostRepository);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(ScheduledPostRepository);
  });
});
