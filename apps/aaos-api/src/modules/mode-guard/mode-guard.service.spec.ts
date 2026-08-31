import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { ModeGuardService } from "./mode-guard.service.js";

function seedTenant(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Record<string, unknown> = {},
): void {
  client.seed("tenants", {
    id: "t-1",
    tenant_id: "dss-motor",
    name: "DSS Motor",
    vertical: "AUTOMOTIVE",
    status: "ACTIVE",
    trial_ends_at: null,
    meta_access_token: null,
    meta_ad_account_id: null,
    meta_api_version: "v21.0",
    mode: "LIVE",
    mode_changed_at: null,
    mode_changed_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("ModeGuardService", () => {
  describe("resolveMode", () => {
    it("resolves LIVE for a tenant whose row has mode='LIVE'", async () => {
      const client = createFakeSupabaseClient();
      seedTenant(client, { mode: "LIVE" });
      const service = new ModeGuardService(new TenantRepository(client));
      await expect(service.resolveMode("dss-motor")).resolves.toBe("LIVE");
    });

    it("resolves DEV for a tenant whose row has mode='DEV'", async () => {
      const client = createFakeSupabaseClient();
      seedTenant(client, { mode: "DEV" });
      const service = new ModeGuardService(new TenantRepository(client));
      await expect(service.resolveMode("dss-motor")).resolves.toBe("DEV");
    });

    it("fails open to LIVE when no tenants row is found", async () => {
      const client = createFakeSupabaseClient();
      const service = new ModeGuardService(new TenantRepository(client));
      await expect(service.resolveMode("missing-tenant")).resolves.toBe("LIVE");
    });

    it("fails open to LIVE when TenantRepository.findByTenantId throws", async () => {
      const client = createFakeSupabaseClient();
      const service = new ModeGuardService(new TenantRepository(client));
      vi.spyOn(TenantRepository.prototype, "findByTenantId").mockRejectedValueOnce(
        new Error("boom"),
      );
      await expect(service.resolveMode("dss-motor")).resolves.toBe("LIVE");
    });

    it("reflects a just-changed DB value on the very next call — no stale cache", async () => {
      const client = createFakeSupabaseClient();
      seedTenant(client, { mode: "LIVE" });
      const repository = new TenantRepository(client);
      const service = new ModeGuardService(repository);

      await expect(service.resolveMode("dss-motor")).resolves.toBe("LIVE");

      await repository.updateByTenantId("dss-motor", {
        mode: "DEV",
        mode_changed_at: "2026-08-31T00:00:00.000Z",
        mode_changed_by: "owner@dss-motor.test",
      });

      // Same service instance, no invalidate()/cache-clearing call of any kind — the very next
      // resolveMode() call must already see the new value.
      await expect(service.resolveMode("dss-motor")).resolves.toBe("DEV");
    });
  });

  describe("executeOrSimulate", () => {
    it("calls simulateFn, not executeFn, when the tenant is in DEV mode", async () => {
      const client = createFakeSupabaseClient();
      seedTenant(client, { mode: "DEV" });
      const service = new ModeGuardService(new TenantRepository(client));
      const executeFn = vi.fn(async () => "executed");
      const simulateFn = vi.fn(async () => "simulated");

      const result = await service.executeOrSimulate("dss-motor", executeFn, simulateFn);

      expect(result).toBe("simulated");
      expect(simulateFn).toHaveBeenCalledTimes(1);
      expect(executeFn).not.toHaveBeenCalled();
    });

    it("calls executeFn, not simulateFn, when the tenant is in LIVE mode", async () => {
      const client = createFakeSupabaseClient();
      seedTenant(client, { mode: "LIVE" });
      const service = new ModeGuardService(new TenantRepository(client));
      const executeFn = vi.fn(async () => "executed");
      const simulateFn = vi.fn(async () => "simulated");

      const result = await service.executeOrSimulate("dss-motor", executeFn, simulateFn);

      expect(result).toBe("executed");
      expect(executeFn).toHaveBeenCalledTimes(1);
      expect(simulateFn).not.toHaveBeenCalled();
    });

    it("calls executeFn (fail-open LIVE) for a tenant with no tenants row at all", async () => {
      const client = createFakeSupabaseClient();
      const service = new ModeGuardService(new TenantRepository(client));
      const executeFn = vi.fn(async () => "executed");
      const simulateFn = vi.fn(async () => "simulated");

      const result = await service.executeOrSimulate("missing-tenant", executeFn, simulateFn);

      expect(result).toBe("executed");
      expect(executeFn).toHaveBeenCalledTimes(1);
      expect(simulateFn).not.toHaveBeenCalled();
    });
  });
});
