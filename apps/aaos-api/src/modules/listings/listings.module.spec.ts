import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ListingRepository } from "./infrastructure/listing.repository.js";
import { ListingsController } from "./listings.controller.js";
import { ListingsModule } from "./listings.module.js";
import { ListingsService } from "./listings.service.js";

describe("ListingsModule", () => {
  it("registers ListingsController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", ListingsModule) as unknown[];
    expect(metadata).toEqual([ListingsController]);
  });

  it("registers ListingsService, ApiKeyGuard, and a ListingRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", ListingsModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(3);
    expect(metadata).toContain(ListingsService);
    expect(metadata).toContain(ApiKeyGuard);
    const repoProvider = metadata.find(
      (p) =>
        typeof p === "object" && p !== null && "provide" in p && p.provide === ListingRepository,
    );
    expect(repoProvider).toBeDefined();
  });
});
