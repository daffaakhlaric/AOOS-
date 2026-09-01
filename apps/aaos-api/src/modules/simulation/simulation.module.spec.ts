import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { LearningModule } from "../learning/learning.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaInterestsModule } from "../meta-interests/meta-interests.module.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { SimulationRepository } from "./infrastructure/simulation.repository.js";
import { SimulationController } from "./simulation.controller.js";
import { SimulationModule } from "./simulation.module.js";
import { SimulationService } from "./simulation.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("SimulationModule", () => {
  it("imports LlmModule (so SimulationService can inject the real LlmService)", () => {
    const metadata = Reflect.getMetadata("imports", SimulationModule) as unknown[];
    expect(metadata).toContain(LlmModule);
  });

  it("imports MetaInterestsModule (so the SAMANTHA stage reads the SAME real MetaInterestRepository the sync endpoint writes through)", () => {
    const metadata = Reflect.getMetadata("imports", SimulationModule) as unknown[];
    expect(metadata).toContain(MetaInterestsModule);
  });

  it("imports LearningModule (AAOS Self-Learning AI Phase B — so SimulationService can inject the real LearningService)", () => {
    const metadata = Reflect.getMetadata("imports", SimulationModule) as unknown[];
    expect(metadata).toContain(LearningModule);
  });

  it("registers SimulationController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", SimulationModule) as unknown[];
    expect(metadata).toEqual([SimulationController]);
  });

  it("registers SimulationService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", SimulationModule) as unknown[];
    expect(metadata).toContain(SimulationService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("provides SimulationRepository via a useFactory built from SUPABASE_CLIENT", () => {
    const metadata = Reflect.getMetadata("providers", SimulationModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === SimulationRepository);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    const repo = provider?.useFactory?.(fakeClient);
    expect(repo).toBeInstanceOf(SimulationRepository);
  });

  it("provides TenantRepository via a useFactory built from SUPABASE_CLIENT (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5 — real per-request vertical resolution, not a second tenant lookup)", () => {
    const metadata = Reflect.getMetadata("providers", SimulationModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === TenantRepository);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    const repo = provider?.useFactory?.(fakeClient);
    expect(repo).toBeInstanceOf(TenantRepository);
  });
});
