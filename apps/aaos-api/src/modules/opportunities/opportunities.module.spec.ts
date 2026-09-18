import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { CampaignHealthModule } from "../campaign-health/campaign-health.module.js";
import { CreativeMemoryModule } from "../creative-memory/creative-memory.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { OpportunitiesController } from "./opportunities.controller.js";
import { OpportunitiesModule } from "./opportunities.module.js";
import { OpportunitiesService } from "./opportunities.service.js";

describe("OpportunitiesModule", () => {
  it("imports CampaignHealthModule and CreativeMemoryModule to reuse their exported services", () => {
    const metadata = Reflect.getMetadata("imports", OpportunitiesModule) as unknown[];
    expect(metadata).toEqual([CampaignHealthModule, CreativeMemoryModule]);
  });

  it("registers OpportunitiesController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", OpportunitiesModule) as unknown[];
    expect(metadata).toEqual([OpportunitiesController]);
  });

  it("registers OpportunitiesService and ApiKeyGuard as providers, and no repository (zero I/O of its own)", () => {
    const metadata = Reflect.getMetadata("providers", OpportunitiesModule) as unknown[];
    expect(metadata).toEqual([OpportunitiesService, ApiKeyGuard]);
  });

  it("exports OpportunitiesService", () => {
    const exportsMetadata = Reflect.getMetadata("exports", OpportunitiesModule) as unknown[];
    expect(exportsMetadata).toEqual([OpportunitiesService]);
  });
});
