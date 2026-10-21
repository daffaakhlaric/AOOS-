import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";

import { TenantAuthorizationService } from "./tenant-authorization.service.js";

const db = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: db.getUser }, from: db.from }),
}));

describe("trusted workspace authorization", () => {
  let memberships: { id: string; tenant_id: string; role: string }[];
  let service: TenantAuthorizationService;
  beforeEach(() => {
    memberships = [{ id: "membership-1", tenant_id: "workspace-a", role: "OWNER" }];
    db.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          user_metadata: { role: "superadmin", tenant_id: "attacker-workspace" },
        },
      },
      error: null,
    });
    db.from.mockImplementation((table: string) => {
      const result =
        table === "tenant_memberships"
          ? { data: memberships, error: null }
          : table === "tenants"
            ? {
                data: { tenant_id: "workspace-a", vertical: "PROPERTY", status: "ACTIVE" },
                error: null,
              }
            : { data: null, error: null };
      const query: any = {
        select: () => query,
        eq: () => query,
        single: async () => result,
        maybeSingle: async () => result,
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });
    service = new TenantAuthorizationService({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_KEY: "fixture",
    } as AaosApiConfig);
  });
  it("uses trusted membership and ignores editable identity metadata", async () => {
    const identity = await service.resolve("session");
    expect(identity).toMatchObject({ tenantId: "workspace-a", role: "OWNER", superadmin: false });
  });
  it("rejects an expired identity before reading memberships", async () => {
    db.from.mockClear();
    db.getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    await expect(service.resolve("expired")).rejects.toThrow("Invalid or expired");
    expect(db.from).not.toHaveBeenCalled();
  });
  it("rejects a workspace outside membership", async () => {
    await expect(service.resolve("session", "workspace-b")).rejects.toThrow("Missing membership");
  });
  it("requires explicit selection when there are multiple memberships", async () => {
    memberships.push({ id: "membership-2", tenant_id: "workspace-b", role: "VIEWER" });
    await expect(service.resolve("session")).rejects.toThrow("explicit workspace");
    expect((await service.resolve("session", "workspace-a")).tenantId).toBe("workspace-a");
  });
  it("fails closed without membership", async () => {
    memberships.length = 0;
    await expect(service.resolve("session")).rejects.toThrow("Missing membership");
  });
  it("rejects inherited object property names as roles", async () => {
    memberships[0]!.role = "constructor";
    await expect(service.resolve("session")).rejects.toThrow("Missing membership");
  });
  it("does not permit viewer writes or integration initiation over GET", async () => {
    memberships[0]!.role = "VIEWER";
    const identity = await service.resolve("session");
    expect(() => service.authorize(identity, "/api/v1/campaigns", "POST")).toThrow("Role cannot");
    expect(() => service.authorize(identity, "/api/v1/meta-oauth/connect", "GET")).toThrow(
      "Role cannot",
    );
    expect(() => service.authorize(identity, "/api/v1/campaigns", "GET")).not.toThrow();
  });
  it("does not grant superadmin access to an owner without entitlement", async () => {
    const identity = await service.resolve("session");
    expect(() => service.authorize(identity, "/api/v1/superadmin/tenants", "GET")).toThrow(
      "entitlement",
    );
  });
});
