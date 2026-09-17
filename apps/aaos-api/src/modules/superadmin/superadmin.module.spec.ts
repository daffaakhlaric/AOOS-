import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";

import { SystemWebhookConfigRepository } from "./infrastructure/system-webhook-config.repository.js";
import { TenantRepository } from "./infrastructure/tenant.repository.js";
import { SuperadminController } from "./superadmin.controller.js";
import { SuperadminModule } from "./superadmin.module.js";
import { SuperadminService } from "./superadmin.service.js";

describe("SuperadminModule", () => {
  it("registers SuperadminController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", SuperadminModule) as unknown[];
    expect(metadata).toEqual([SuperadminController]);
  });

  it("imports CampaignsModule (Campaign->Listing Mapping backfill endpoint)", () => {
    const metadata = Reflect.getMetadata("imports", SuperadminModule) as unknown[];
    expect(metadata).toContain(CampaignsModule);
  });

  it("registers SuperadminService, ApiKeyGuard, and TenantRepository/WabaConfigRepository/SystemWebhookConfigRepository factories as providers", () => {
    const metadata = Reflect.getMetadata("providers", SuperadminModule) as Array<
      { provide?: unknown } | unknown
    >;
    expect(metadata).toHaveLength(5);
    expect(metadata).toContain(SuperadminService);
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
    const webhookConfigRepoProvider = metadata.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in p &&
        p.provide === SystemWebhookConfigRepository,
    );
    expect(webhookConfigRepoProvider).toBeDefined();
  });

  it("exports TenantRepository", () => {
    const metadata = Reflect.getMetadata("exports", SuperadminModule) as unknown[];
    expect(metadata).toContain(TenantRepository);
  });
});
