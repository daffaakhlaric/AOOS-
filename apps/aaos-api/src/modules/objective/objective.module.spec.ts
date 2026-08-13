import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ObjectiveController } from "./objective.controller.js";
import { ObjectiveModule } from "./objective.module.js";
import { ObjectiveService } from "./objective.service.js";

describe("ObjectiveModule", () => {
  it("registers ObjectiveController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", ObjectiveModule) as unknown[];
    expect(metadata).toEqual([ObjectiveController]);
  });

  it("registers ObjectiveService and ApiKeyGuard as providers", () => {
    const metadata = Reflect.getMetadata("providers", ObjectiveModule) as unknown[];
    expect(metadata).toEqual([ObjectiveService, ApiKeyGuard]);
  });
});
