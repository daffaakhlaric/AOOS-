import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import { SimulationRepository } from "../simulation/infrastructure/simulation.repository.js";

import { GoLiveController } from "./go-live.controller.js";
import { GoLiveModule } from "./go-live.module.js";
import { GoLiveService } from "./go-live.service.js";

describe("GoLiveModule", () => {
  it("registers GoLiveController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", GoLiveModule) as unknown[];
    expect(metadata).toEqual([GoLiveController]);
  });

  it("registers GoLiveService, ApiKeyGuard, and SimulationRepository/WabaConfigRepository factories as providers", () => {
    const metadata = Reflect.getMetadata("providers", GoLiveModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(4);
    expect(metadata).toContain(GoLiveService);
    expect(metadata).toContain(ApiKeyGuard);
    const simulationRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" && p !== null && "provide" in p && p.provide === SimulationRepository,
    );
    expect(simulationRepoProvider).toBeDefined();
    const wabaRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" && p !== null && "provide" in p && p.provide === WabaConfigRepository,
    );
    expect(wabaRepoProvider).toBeDefined();
  });
});
