import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { GrowthObjectivesController } from "./growth-objectives.controller.js";
import { GrowthObjectivesModule } from "./growth-objectives.module.js";
import { GrowthObjectivesService } from "./growth-objectives.service.js";
import { GrowthObjectiveRepository } from "./infrastructure/growth-objective.repository.js";

describe("GrowthObjectivesModule", () => {
  it("registers GrowthObjectivesController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", GrowthObjectivesModule) as unknown[];
    expect(metadata).toEqual([GrowthObjectivesController]);
  });

  it("registers GrowthObjectivesService, ApiKeyGuard, and a GrowthObjectiveRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", GrowthObjectivesModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(3);
    expect(metadata).toContain(GrowthObjectivesService);
    expect(metadata).toContain(ApiKeyGuard);
    const repoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === GrowthObjectiveRepository,
    );
    expect(repoProvider).toBeDefined();
  });

  it("exports GrowthObjectivesService", () => {
    const exportsMetadata = Reflect.getMetadata("exports", GrowthObjectivesModule) as unknown[];
    expect(exportsMetadata).toEqual([GrowthObjectivesService]);
  });
});
