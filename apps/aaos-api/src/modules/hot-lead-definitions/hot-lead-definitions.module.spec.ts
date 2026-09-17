import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { HotLeadDefinitionsController } from "./hot-lead-definitions.controller.js";
import { HotLeadDefinitionsModule } from "./hot-lead-definitions.module.js";
import { HotLeadDefinitionsService } from "./hot-lead-definitions.service.js";
import { HotLeadDefinitionRepository } from "./infrastructure/hot-lead-definition.repository.js";

describe("HotLeadDefinitionsModule", () => {
  it("registers HotLeadDefinitionsController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", HotLeadDefinitionsModule) as unknown[];
    expect(metadata).toEqual([HotLeadDefinitionsController]);
  });

  it("registers HotLeadDefinitionsService, ApiKeyGuard, and a HotLeadDefinitionRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", HotLeadDefinitionsModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(3);
    expect(metadata).toContain(HotLeadDefinitionsService);
    expect(metadata).toContain(ApiKeyGuard);
    const repoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === HotLeadDefinitionRepository,
    );
    expect(repoProvider).toBeDefined();
  });

  it("exports HotLeadDefinitionsService", () => {
    const exportsMetadata = Reflect.getMetadata("exports", HotLeadDefinitionsModule) as unknown[];
    expect(exportsMetadata).toEqual([HotLeadDefinitionsService]);
  });
});
