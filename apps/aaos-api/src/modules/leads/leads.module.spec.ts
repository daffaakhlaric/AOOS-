import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { LeadsController } from "./leads.controller.js";
import { LeadsModule } from "./leads.module.js";
import { LeadsService } from "./leads.service.js";

describe("LeadsModule", () => {
  it("registers LeadsController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", LeadsModule) as unknown[];
    expect(metadata).toEqual([LeadsController]);
  });

  it("registers LeadsService and ApiKeyGuard as providers", () => {
    const metadata = Reflect.getMetadata("providers", LeadsModule) as unknown[];
    expect(metadata).toEqual([LeadsService, ApiKeyGuard]);
  });
});
