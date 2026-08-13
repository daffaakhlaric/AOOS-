import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { CREATIVE_PACKAGE_STORE } from "../../di-tokens.js";

import { CreativePackagesController } from "./creative-packages.controller.js";
import { CreativePackagesModule } from "./creative-packages.module.js";

describe("CreativePackagesModule", () => {
  it("registers CreativePackagesController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", CreativePackagesModule) as unknown[];
    expect(metadata).toEqual([CreativePackagesController]);
  });

  it("provides CREATIVE_PACKAGE_STORE via a seeding useFactory", () => {
    const metadata = Reflect.getMetadata("providers", CreativePackagesModule) as Array<{
      provide?: unknown;
      useFactory?: () => unknown;
    }>;
    const storeProvider = metadata.find((p) => p.provide === CREATIVE_PACKAGE_STORE);
    expect(storeProvider).toBeDefined();
    const store = storeProvider?.useFactory?.() as { list: () => unknown[] };
    expect(store.list().length).toBeGreaterThan(0);
  });
});
