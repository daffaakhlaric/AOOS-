import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativeStressTestController } from "./creative-stress-test.controller.js";
import { CreativeStressTestModule } from "./creative-stress-test.module.js";
import { CreativeStressTestService } from "./creative-stress-test.service.js";
import { StressTestRunRepository } from "./infrastructure/stress-test-run.repository.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("CreativeStressTestModule", () => {
  it("registers CreativeStressTestController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", CreativeStressTestModule) as unknown[];
    expect(metadata).toEqual([CreativeStressTestController]);
  });

  it("registers CreativeStressTestService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", CreativeStressTestModule) as unknown[];
    expect(metadata).toContain(CreativeStressTestService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("provides StressTestRunRepository from the SHARED SUPABASE_CLIENT (not a second connection)", () => {
    const metadata = Reflect.getMetadata(
      "providers",
      CreativeStressTestModule,
    ) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === StressTestRunRepository);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(StressTestRunRepository);
  });

  it("does not import SimulationModule or GoLiveModule (no naming/table collision)", () => {
    const metadata = (Reflect.getMetadata("imports", CreativeStressTestModule) as unknown[]) ?? [];
    const names = metadata.map((m) => (m as { name?: string }).name);
    expect(names).not.toContain("SimulationModule");
    expect(names).not.toContain("GoLiveModule");
  });
});
