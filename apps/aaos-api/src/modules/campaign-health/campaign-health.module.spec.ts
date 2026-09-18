import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetricSnapshotModule } from "../metric-snapshot/metric-snapshot.module.js";

import { CampaignHealthController } from "./campaign-health.controller.js";
import { CampaignHealthModule } from "./campaign-health.module.js";
import { CampaignHealthService } from "./campaign-health.service.js";
import { CampaignAssessmentRepository } from "./infrastructure/campaign-assessment.repository.js";

describe("CampaignHealthModule", () => {
  it("imports MetricSnapshotModule to reuse its exported MetricSnapshotService", () => {
    const metadata = Reflect.getMetadata("imports", CampaignHealthModule) as unknown[];
    expect(metadata).toEqual([MetricSnapshotModule]);
  });

  it("registers CampaignHealthController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", CampaignHealthModule) as unknown[];
    expect(metadata).toEqual([CampaignHealthController]);
  });

  it("registers CampaignHealthService, ApiKeyGuard, and a CampaignAssessmentRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", CampaignHealthModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(3);
    expect(metadata).toContain(CampaignHealthService);
    expect(metadata).toContain(ApiKeyGuard);
    const repoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === CampaignAssessmentRepository,
    );
    expect(repoProvider).toBeDefined();
  });

  it("exports CampaignHealthService", () => {
    const exportsMetadata = Reflect.getMetadata("exports", CampaignHealthModule) as unknown[];
    expect(exportsMetadata).toEqual([CampaignHealthService]);
  });
});
