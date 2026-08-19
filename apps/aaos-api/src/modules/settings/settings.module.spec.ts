import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { WabaConfigRepository } from "./infrastructure/waba-config.repository.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsModule } from "./settings.module.js";
import { SettingsService } from "./settings.service.js";

describe("SettingsModule", () => {
  it("registers SettingsController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", SettingsModule) as unknown[];
    expect(metadata).toEqual([SettingsController]);
  });

  it("registers SettingsService, ApiKeyGuard, and TenantRepository/WabaConfigRepository factories as providers", () => {
    const metadata = Reflect.getMetadata("providers", SettingsModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(4);
    expect(metadata).toContain(SettingsService);
    expect(metadata).toContain(ApiKeyGuard);
    const tenantRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" && p !== null && "provide" in p && p.provide === TenantRepository,
    );
    expect(tenantRepoProvider).toBeDefined();
    const wabaRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" && p !== null && "provide" in p && p.provide === WabaConfigRepository,
    );
    expect(wabaRepoProvider).toBeDefined();
  });
});
