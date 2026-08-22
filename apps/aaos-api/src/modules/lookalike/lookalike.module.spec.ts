import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { MetaAudienceRepository } from "./infrastructure/meta-audience.repository.js";
import { LookalikeController } from "./lookalike.controller.js";
import { LookalikeModule } from "./lookalike.module.js";
import { LookalikeService } from "./lookalike.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("LookalikeModule", () => {
  it("registers LookalikeController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", LookalikeModule) as unknown[];
    expect(metadata).toEqual([LookalikeController]);
  });

  it("registers LookalikeService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", LookalikeModule) as unknown[];
    expect(metadata).toContain(LookalikeService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("exports LookalikeService so SchedulerModule can inject it", () => {
    const metadata = Reflect.getMetadata("exports", LookalikeModule) as unknown[];
    expect(metadata).toEqual([LookalikeService]);
  });

  it("provides MetaAudienceRepository from the SHARED SUPABASE_CLIENT (not a second connection)", () => {
    const metadata = Reflect.getMetadata("providers", LookalikeModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === MetaAudienceRepository);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(MetaAudienceRepository);
  });
});
