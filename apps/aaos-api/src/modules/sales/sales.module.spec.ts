import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SalesController } from "./sales.controller.js";
import { SalesModule } from "./sales.module.js";
import { SalesService } from "./sales.service.js";

describe("SalesModule", () => {
  it("registers SalesController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", SalesModule) as unknown[];
    expect(metadata).toEqual([SalesController]);
  });

  it("registers SalesService and ApiKeyGuard as providers", () => {
    const metadata = Reflect.getMetadata("providers", SalesModule) as unknown[];
    expect(metadata).toEqual([SalesService, ApiKeyGuard]);
  });
});
