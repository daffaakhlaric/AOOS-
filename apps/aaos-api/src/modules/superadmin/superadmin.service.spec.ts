import { ConflictError, NotFoundError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import type {
  SupabaseAuthAdminLike,
  SupabaseAuthUserLike,
} from "../sales/infrastructure/supabase-auth-admin.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";

import { TenantRepository } from "./infrastructure/tenant.repository.js";
import { SuperadminService } from "./superadmin.service.js";

function buildFakeAuthAdmin(): SupabaseAuthAdminLike & {
  users: Map<string, SupabaseAuthUserLike>;
} {
  const users = new Map<string, SupabaseAuthUserLike>();
  let nextId = 1;
  return {
    users,
    auth: {
      admin: {
        createUser: vi.fn(async (input) => {
          if ([...users.values()].some((u) => u.email === input.email)) {
            return {
              data: null,
              error: { message: "A user with this email address has already been registered" },
            };
          }
          const user: SupabaseAuthUserLike = {
            id: `auth-${String(nextId++)}`,
            email: input.email,
            user_metadata: input.user_metadata,
            last_sign_in_at: null,
          };
          users.set(user.id, user);
          return { data: { user }, error: null };
        }),
        updateUserById: vi.fn(async (userId, input) => {
          const existing = users.get(userId);
          if (existing === undefined) {
            return { data: null, error: { message: "user not found" } };
          }
          const updated: SupabaseAuthUserLike = {
            ...existing,
            ...(input.user_metadata !== undefined ? { user_metadata: input.user_metadata } : {}),
          };
          users.set(userId, updated);
          return { data: { user: updated }, error: null };
        }),
        getUserById: vi.fn(async (userId) => {
          const existing = users.get(userId);
          return existing === undefined
            ? { data: null, error: { message: "not found" } }
            : { data: { user: existing }, error: null };
        }),
        listUsers: vi.fn(async () => ({ data: { users: [...users.values()] }, error: null })),
        generateLink: vi.fn(async (input) => ({
          data: { properties: { action_link: `https://example.test/verify?email=${input.email}` } },
          error: null,
        })),
      },
    },
  };
}

function buildService() {
  const client = createFakeSupabaseClient();
  const tenants = new TenantRepository(client);
  const wabaConfigs = new WabaConfigRepository(client);
  const authAdmin = buildFakeAuthAdmin();
  const service = new SuperadminService(tenants, wabaConfigs, authAdmin, buildTestConfig());
  return { service, tenants, wabaConfigs, authAdmin, client };
}

describe("SuperadminService", () => {
  it("create() provisions a real Supabase Auth admin user and a tenants row", async () => {
    const { service, authAdmin } = buildService();
    const result = await service.create({
      name: "PropertyKlik Demo",
      tenantId: "propertyklik-demo",
      vertical: "PROPERTY",
      adminEmail: "admin@propertyklik.id",
      adminPassword: "password123",
      status: "TRIAL",
    });
    expect(result.tenantId).toBe("propertyklik-demo");
    expect(result.vertical).toBe("PROPERTY");
    expect(result.status).toBe("TRIAL");
    expect(authAdmin.users.size).toBe(1);
    const [user] = [...authAdmin.users.values()];
    expect(user?.user_metadata).toMatchObject({ tenantId: "propertyklik-demo", role: "owner" });
  });

  it("create() rejects a duplicate tenantId with ConflictError", async () => {
    const { service } = buildService();
    await service.create({
      name: "A",
      tenantId: "dup",
      vertical: "AUTOMOTIVE",
      adminEmail: "a@a.com",
      adminPassword: "password123",
      status: "TRIAL",
    });
    await expect(
      service.create({
        name: "B",
        tenantId: "dup",
        vertical: "AUTOMOTIVE",
        adminEmail: "b@b.com",
        adminPassword: "password123",
        status: "TRIAL",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("create() with a waba block also inserts a waba_configs row", async () => {
    const { service, wabaConfigs } = buildService();
    await service.create({
      name: "PropertyKlik Demo",
      tenantId: "propertyklik-demo",
      vertical: "PROPERTY",
      adminEmail: "admin@propertyklik.id",
      adminPassword: "password123",
      status: "ACTIVE",
      waba: {
        branchId: "jakarta",
        phoneNumber: "+6281100000",
        wabaId: "waba-1",
        phoneNumberId: "phone-1",
        accessToken: "token-1",
      },
    });
    const rows = await wabaConfigs.listByTenant("propertyklik-demo");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.branch_id).toBe("JAKARTA");
  });

  it("list() returns tenants with a computed KPI strip", async () => {
    const { service } = buildService();
    await service.create({
      name: "A",
      tenantId: "a",
      vertical: "AUTOMOTIVE",
      adminEmail: "a@a.com",
      adminPassword: "password123",
      status: "ACTIVE",
    });
    await service.create({
      name: "B",
      tenantId: "b",
      vertical: "PROPERTY",
      adminEmail: "b@b.com",
      adminPassword: "password123",
      status: "TRIAL",
    });
    const result = await service.list();
    expect(result.kpi.totalTenants).toBe(2);
    expect(result.kpi.activeTenants).toBe(1);
    expect(result.kpi.trialTenants).toBe(1);
    expect(result.tenants).toHaveLength(2);
  });

  it("update() suspends a tenant", async () => {
    const { service } = buildService();
    await service.create({
      name: "A",
      tenantId: "a",
      vertical: "AUTOMOTIVE",
      adminEmail: "a@a.com",
      adminPassword: "password123",
      status: "ACTIVE",
    });
    const updated = await service.update("a", { status: "SUSPENDED" });
    expect(updated.status).toBe("SUSPENDED");
  });

  it("update() throws NotFoundError for an unknown tenant", async () => {
    const { service } = buildService();
    await expect(service.update("missing", { status: "SUSPENDED" })).rejects.toThrow(NotFoundError);
  });

  it("impersonate() mints a real magic link for the tenant's admin and logs the event", async () => {
    const { service } = buildService();
    await service.create({
      name: "A",
      tenantId: "a",
      vertical: "AUTOMOTIVE",
      adminEmail: "admin@a.com",
      adminPassword: "password123",
      status: "ACTIVE",
    });
    const result = await service.impersonate({
      tenantId: "a",
      actorEmail: "superadmin@aaos.id",
      actorId: "super-1",
    });
    expect(result.adminEmail).toBe("admin@a.com");
    expect(result.actionLink).toContain("admin@a.com");
  });

  it("impersonate() throws NotFoundError for an unknown tenant", async () => {
    const { service } = buildService();
    await expect(
      service.impersonate({ tenantId: "missing", actorEmail: "s@a.com", actorId: "s-1" }),
    ).rejects.toThrow(NotFoundError);
  });
});
