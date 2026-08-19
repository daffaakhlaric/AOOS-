import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SalesHumanRepository } from "./infrastructure/sales-human.repository.js";
import { SalesHumansController } from "./sales-humans.controller.js";
import { SalesHumansService } from "./sales-humans.service.js";
import { SalesController } from "./sales.controller.js";
import { SalesModule } from "./sales.module.js";
import { SalesService } from "./sales.service.js";

describe("SalesModule", () => {
  it("registers SalesController and SalesHumansController as its controllers", () => {
    const metadata = Reflect.getMetadata("controllers", SalesModule) as unknown[];
    expect(metadata).toEqual([SalesController, SalesHumansController]);
  });

  it("registers SalesService, SalesHumansService, ApiKeyGuard, and a SalesHumanRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", SalesModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(4);
    expect(metadata).toContain(SalesService);
    expect(metadata).toContain(SalesHumansService);
    expect(metadata).toContain(ApiKeyGuard);
    const repoProvider = metadata.find(
      (p) =>
        typeof p === "object" && p !== null && "provide" in p && p.provide === SalesHumanRepository,
    );
    expect(repoProvider).toBeDefined();
  });
});
