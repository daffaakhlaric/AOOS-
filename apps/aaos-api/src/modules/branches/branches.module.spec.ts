import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { BranchesController } from "./branches.controller.js";
import { BranchesModule } from "./branches.module.js";
import { BranchesService } from "./branches.service.js";

describe("BranchesModule", () => {
  it("registers BranchesController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", BranchesModule) as unknown[];
    expect(metadata).toEqual([BranchesController]);
  });

  it("registers BranchesService and ApiKeyGuard as providers", () => {
    const metadata = Reflect.getMetadata("providers", BranchesModule) as unknown[];
    expect(metadata).toEqual([BranchesService, ApiKeyGuard]);
  });
});
