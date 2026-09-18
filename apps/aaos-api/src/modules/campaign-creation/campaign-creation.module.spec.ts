import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { GrowthObjectivesModule } from "../growth-objectives/growth-objectives.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignCreationController } from "./campaign-creation.controller.js";
import { CampaignCreationModule } from "./campaign-creation.module.js";
import { CampaignCreationService } from "./campaign-creation.service.js";

describe("CampaignCreationModule", () => {
  it("imports ListingsModule and GrowthObjectivesModule to reuse their exported services", () => {
    const metadata = Reflect.getMetadata("imports", CampaignCreationModule) as unknown[];
    expect(metadata).toEqual([ListingsModule, GrowthObjectivesModule]);
  });

  it("registers CampaignCreationController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", CampaignCreationModule) as unknown[];
    expect(metadata).toEqual([CampaignCreationController]);
  });

  it("registers CampaignCreationService and ApiKeyGuard as providers", () => {
    const metadata = Reflect.getMetadata("providers", CampaignCreationModule) as unknown[];
    expect(metadata).toEqual([CampaignCreationService, ApiKeyGuard]);
  });

  it("exports CampaignCreationService", () => {
    const metadata = Reflect.getMetadata("exports", CampaignCreationModule) as unknown[];
    expect(metadata).toEqual([CampaignCreationService]);
  });
});
