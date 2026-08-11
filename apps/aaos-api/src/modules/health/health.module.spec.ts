import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller.js";
import { HealthModule } from "./health.module.js";

describe("HealthModule", () => {
  it("registers HealthController as its only controller", () => {
    const metadata = Reflect.getMetadata("controllers", HealthModule) as unknown[];
    expect(metadata).toEqual([HealthController]);
  });

  it("registers no providers of its own (config/connector come from the global AppModule)", () => {
    const metadata = Reflect.getMetadata("providers", HealthModule) as unknown[] | undefined;
    expect(metadata).toBeUndefined();
  });
});
