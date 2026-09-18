import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { HotLeadDefinitionsModule } from "../hot-lead-definitions/hot-lead-definitions.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetricSnapshotModule } from "../metric-snapshot/metric-snapshot.module.js";

import { GrowthObjectivesController } from "./growth-objectives.controller.js";
import { GrowthObjectivesModule } from "./growth-objectives.module.js";
import { GrowthObjectivesService } from "./growth-objectives.service.js";
import { GrowthMetricsRepository } from "./infrastructure/growth-metrics.repository.js";
import { GrowthObjectiveCampaignsRepository } from "./infrastructure/growth-objective-campaigns.repository.js";
import { GrowthObjectiveRepository } from "./infrastructure/growth-objective.repository.js";

describe("GrowthObjectivesModule", () => {
  it("imports HotLeadDefinitionsModule and MetricSnapshotModule (Phase 1 Part B's analyze() dependencies)", () => {
    const metadata = Reflect.getMetadata("imports", GrowthObjectivesModule) as unknown[];
    expect(metadata).toEqual([HotLeadDefinitionsModule, MetricSnapshotModule]);
  });

  it("registers GrowthObjectivesController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", GrowthObjectivesModule) as unknown[];
    expect(metadata).toEqual([GrowthObjectivesController]);
  });

  it("registers GrowthObjectivesService, ApiKeyGuard, and GrowthObjectiveRepository/GrowthMetricsRepository/GrowthObjectiveCampaignsRepository factories as providers", () => {
    const metadata = Reflect.getMetadata("providers", GrowthObjectivesModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(5);
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
    const metricsRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === GrowthMetricsRepository,
    );
    expect(metricsRepoProvider).toBeDefined();
    const campaignsRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === GrowthObjectiveCampaignsRepository,
    );
    expect(campaignsRepoProvider).toBeDefined();
  });

  it("exports GrowthObjectivesService", () => {
    const exportsMetadata = Reflect.getMetadata("exports", GrowthObjectivesModule) as unknown[];
    expect(exportsMetadata).toEqual([GrowthObjectivesService]);
  });
});
