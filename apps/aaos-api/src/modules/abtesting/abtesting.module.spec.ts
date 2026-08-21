import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { CreativePackagesModule } from "../creative-packages/creative-packages.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AbTestingController } from "./abtesting.controller.js";
import { AbTestingModule } from "./abtesting.module.js";
import { AbTestingService } from "./abtesting.service.js";
import { AbTestVariantRepository } from "./infrastructure/ab-test-variant.repository.js";
import { AbTestRepository } from "./infrastructure/ab-test.repository.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("AbTestingModule", () => {
  it("imports CreativePackagesModule so AbTestingService can inject the real CreativePackagesService", () => {
    const metadata = Reflect.getMetadata("imports", AbTestingModule) as unknown[];
    expect(metadata).toEqual([CreativePackagesModule]);
  });

  it("registers AbTestingController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", AbTestingModule) as unknown[];
    expect(metadata).toEqual([AbTestingController]);
  });

  it("registers AbTestingService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", AbTestingModule) as unknown[];
    expect(metadata).toContain(AbTestingService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("exports AbTestingService so SchedulerModule can inject it", () => {
    const metadata = Reflect.getMetadata("exports", AbTestingModule) as unknown[];
    expect(metadata).toEqual([AbTestingService]);
  });

  it.each([
    ["AbTestRepository", AbTestRepository],
    ["AbTestVariantRepository", AbTestVariantRepository],
  ])("provides %s from the SHARED SUPABASE_CLIENT (not a second connection)", (_name, klass) => {
    const metadata = Reflect.getMetadata("providers", AbTestingModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === klass);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(
      klass as new (...args: never[]) => unknown,
    );
  });
});
