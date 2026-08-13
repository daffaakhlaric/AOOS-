import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsModule } from "./campaigns.module.js";
import { CampaignsService } from "./campaigns.service.js";

describe("CampaignsModule (AAOS-W1D-S3)", () => {
  it("registers CampaignsController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", CampaignsModule) as unknown[];
    expect(metadata).toEqual([CampaignsController]);
  });

  it("registers CampaignsService and ApiKeyGuard as providers", () => {
    const metadata = Reflect.getMetadata("providers", CampaignsModule) as unknown[];
    expect(metadata).toEqual([CampaignsService, ApiKeyGuard]);
  });
});
