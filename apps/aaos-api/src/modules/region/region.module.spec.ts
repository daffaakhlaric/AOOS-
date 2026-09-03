import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { RegionController } from "./region.controller.js";
import { RegionModule } from "./region.module.js";
import { RegionService } from "./region.service.js";

describe("RegionModule", () => {
  it("registers RegionController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", RegionModule) as unknown[];
    expect(metadata).toEqual([RegionController]);
  });

  it("registers RegionService and ApiKeyGuard as providers — no SUPABASE_CLIENT/repository, this module has no DB dependency", () => {
    const metadata = Reflect.getMetadata("providers", RegionModule) as unknown[];
    expect(metadata).toEqual([RegionService, ApiKeyGuard]);
  });
});
