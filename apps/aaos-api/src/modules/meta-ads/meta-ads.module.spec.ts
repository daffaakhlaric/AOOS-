import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { MetaAdsController } from "./meta-ads.controller.js";
import { MetaAdsModule } from "./meta-ads.module.js";
import { MetaAdsService } from "./meta-ads.service.js";

describe("MetaAdsModule", () => {
  it("registers MetaAdsController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", MetaAdsModule) as unknown[];
    expect(metadata).toEqual([MetaAdsController]);
  });

  it("registers MetaAdsService, ApiKeyGuard, and the AdTenantIndexRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", MetaAdsModule) as unknown[];
    expect(metadata).toHaveLength(3);
    expect(metadata[0]).toBe(MetaAdsService);
    expect(metadata[1]).toBe(ApiKeyGuard);
  });
});
