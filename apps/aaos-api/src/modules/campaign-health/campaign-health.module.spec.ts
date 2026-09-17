import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetricSnapshotModule } from "../metric-snapshot/metric-snapshot.module.js";

import { CampaignHealthController } from "./campaign-health.controller.js";
import { CampaignHealthModule } from "./campaign-health.module.js";
import { CampaignHealthService } from "./campaign-health.service.js";

describe("CampaignHealthModule", () => {
  it("imports MetricSnapshotModule to reuse its exported MetricSnapshotService", () => {
    const metadata = Reflect.getMetadata("imports", CampaignHealthModule) as unknown[];
    expect(metadata).toEqual([MetricSnapshotModule]);
  });

  it("registers CampaignHealthController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", CampaignHealthModule) as unknown[];
    expect(metadata).toEqual([CampaignHealthController]);
  });

  it("registers CampaignHealthService and ApiKeyGuard as providers — no new repository", () => {
    const metadata = Reflect.getMetadata("providers", CampaignHealthModule) as unknown[];
    expect(metadata).toEqual([CampaignHealthService, ApiKeyGuard]);
  });

  it("exports CampaignHealthService", () => {
    const exportsMetadata = Reflect.getMetadata("exports", CampaignHealthModule) as unknown[];
    expect(exportsMetadata).toEqual([CampaignHealthService]);
  });
});
