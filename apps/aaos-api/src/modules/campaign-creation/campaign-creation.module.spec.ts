import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { GrowthObjectivesModule } from "../growth-objectives/growth-objectives.module.js";
import { GrowthObjectiveCampaignsRepository } from "../growth-objectives/infrastructure/growth-objective-campaigns.repository.js";
import { ListingsModule } from "../listings/listings.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { CampaignCreationController } from "./campaign-creation.controller.js";
import { CampaignCreationModule } from "./campaign-creation.module.js";
import { CampaignCreationService } from "./campaign-creation.service.js";
import { CampaignCreationRepository } from "./infrastructure/campaign-creation.repository.js";

describe("CampaignCreationModule", () => {
  it("imports ListingsModule, GrowthObjectivesModule, ModeGuardModule, and ActivityLogModule", () => {
    const metadata = Reflect.getMetadata("imports", CampaignCreationModule) as unknown[];
    expect(metadata).toEqual([
      ListingsModule,
      GrowthObjectivesModule,
      ModeGuardModule,
      ActivityLogModule,
    ]);
  });

  it("registers CampaignCreationController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", CampaignCreationModule) as unknown[];
    expect(metadata).toEqual([CampaignCreationController]);
  });

  it("registers CampaignCreationService, ApiKeyGuard, a CampaignCreationRepository provider, and a GrowthObjectiveCampaignsRepository provider", () => {
    const metadata = Reflect.getMetadata("providers", CampaignCreationModule) as ReadonlyArray<
      unknown | { readonly provide: unknown }
    >;
    expect(metadata).toHaveLength(4);
    expect(metadata[0]).toBe(CampaignCreationService);
    expect(metadata[1]).toBe(ApiKeyGuard);
    expect((metadata[2] as { readonly provide: unknown }).provide).toBe(CampaignCreationRepository);
    expect((metadata[3] as { readonly provide: unknown }).provide).toBe(
      GrowthObjectiveCampaignsRepository,
    );
  });

  it("exports CampaignCreationService", () => {
    const metadata = Reflect.getMetadata("exports", CampaignCreationModule) as unknown[];
    expect(metadata).toEqual([CampaignCreationService]);
  });
});
