import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { MetaInterestRepository } from "./infrastructure/meta-interest.repository.js";
import { MetaInterestsController } from "./meta-interests.controller.js";
import { MetaInterestsModule } from "./meta-interests.module.js";
import { MetaInterestsService } from "./meta-interests.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("MetaInterestsModule", () => {
  it("registers MetaInterestsController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", MetaInterestsModule) as unknown[];
    expect(metadata).toEqual([MetaInterestsController]);
  });

  it("registers MetaInterestsService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", MetaInterestsModule) as unknown[];
    expect(metadata).toContain(MetaInterestsService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("provides MetaInterestRepository via a useFactory built from the SHARED SUPABASE_CLIENT", () => {
    const metadata = Reflect.getMetadata("providers", MetaInterestsModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === MetaInterestRepository);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(MetaInterestRepository);
  });

  it("exports MetaInterestRepository so SimulationModule reuses it rather than composing a second one", () => {
    const metadata = Reflect.getMetadata("exports", MetaInterestsModule) as unknown[];
    expect(metadata).toEqual([MetaInterestRepository]);
  });
});
