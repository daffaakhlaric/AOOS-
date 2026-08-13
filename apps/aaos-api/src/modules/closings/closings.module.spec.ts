import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ClosingsController } from "./closings.controller.js";
import { ClosingsModule } from "./closings.module.js";
import { ClosingsService } from "./closings.service.js";

describe("ClosingsModule", () => {
  it("registers ClosingsController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", ClosingsModule) as unknown[];
    expect(metadata).toEqual([ClosingsController]);
  });

  it("registers ClosingsService and ApiKeyGuard as providers", () => {
    const metadata = Reflect.getMetadata("providers", ClosingsModule) as unknown[];
    expect(metadata).toEqual([ClosingsService, ApiKeyGuard]);
  });
});
