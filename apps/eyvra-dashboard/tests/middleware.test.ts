import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

import { middleware } from "@/middleware";

function buildRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3001"));
}

describe("middleware", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes /login through without checking session", async () => {
    const response = await middleware(buildRequest("/login"));
    expect(getSession).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("redirects to /login when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const response = await middleware(buildRequest("/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects a 'sales' role session to NEXT_PUBLIC_CRM_URL", async () => {
    process.env["NEXT_PUBLIC_CRM_URL"] = "https://crm.example.test";
    getSession.mockResolvedValue({ userId: "u1", role: "sales" });
    const response = await middleware(buildRequest("/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://crm.example.test/");
  });

  it("does NOT redirect a 'sales' role session when NEXT_PUBLIC_CRM_URL is unset (regression: this used to fall back to '/', which is itself a protected path — an immediate self-redirect loop, ERR_TOO_MANY_REDIRECTS, since middleware would just see the same 'sales' session on '/' and redirect to '/' again)", async () => {
    delete process.env["NEXT_PUBLIC_CRM_URL"];
    getSession.mockResolvedValue({ userId: "u1", role: "sales" });
    const response = await middleware(buildRequest("/dashboard"));
    expect(response.status).toBe(200);
  });

  it("does not redirect a 'sales' role session when NEXT_PUBLIC_CRM_URL is set to an empty string", async () => {
    process.env["NEXT_PUBLIC_CRM_URL"] = "";
    getSession.mockResolvedValue({ userId: "u1", role: "sales" });
    const response = await middleware(buildRequest("/dashboard"));
    expect(response.status).toBe(200);
  });

  it("allows a manager/owner session through", async () => {
    getSession.mockResolvedValue({ userId: "u1", role: "manager" });
    const response = await middleware(buildRequest("/dashboard"));
    expect(response.status).toBe(200);
  });

  it("redirects /leads to /clara/inbox without checking session (MENU RESTRUCTURE FINAL)", async () => {
    const response = await middleware(buildRequest("/leads"));
    expect(getSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/clara/inbox");
  });

  it("redirects /knowledge to /clara/knowledge", async () => {
    const response = await middleware(buildRequest("/knowledge"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/clara/knowledge");
  });

  it("redirects /simulator to /clara/simulator", async () => {
    const response = await middleware(buildRequest("/simulator"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/clara/simulator");
  });

  it("does NOT redirect a nested path like /leads/abc — only the exact /leads path", async () => {
    getSession.mockResolvedValue({ userId: "u1", role: "manager" });
    const response = await middleware(buildRequest("/leads/abc"));
    expect(response.status).toBe(200);
  });

  describe("/superadmin/* gating (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY)", () => {
    it("passes /superadmin/login through without checking session", async () => {
      const response = await middleware(buildRequest("/superadmin/login"));
      expect(getSession).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("redirects an unauthenticated /superadmin/tenants page request to /superadmin/login", async () => {
      getSession.mockResolvedValue(null);
      const response = await middleware(buildRequest("/superadmin"));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/superadmin/login");
    });

    it("returns 401 JSON for an unauthenticated /api/superadmin/* call (never a redirect an API client can't follow)", async () => {
      getSession.mockResolvedValue(null);
      const response = await middleware(buildRequest("/api/superadmin/tenants"));
      expect(response.status).toBe(401);
    });

    it("redirects a non-superadmin session away from a /superadmin page", async () => {
      getSession.mockResolvedValue({ userId: "u1", role: "manager", tenantId: "dss-motor" });
      const response = await middleware(buildRequest("/superadmin"));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/superadmin/login");
    });

    it("returns 403 JSON for a non-superadmin session calling /api/superadmin/*", async () => {
      getSession.mockResolvedValue({ userId: "u1", role: "manager", tenantId: "dss-motor" });
      const response = await middleware(buildRequest("/api/superadmin/tenants"));
      expect(response.status).toBe(403);
    });

    it("allows a real superadmin session through to /superadmin", async () => {
      getSession.mockResolvedValue({ userId: "u1", role: "superadmin", tenantId: "dss-motor" });
      const response = await middleware(buildRequest("/superadmin"));
      expect(response.status).toBe(200);
    });

    it("allows a real superadmin session through to /api/superadmin/tenants", async () => {
      getSession.mockResolvedValue({ userId: "u1", role: "superadmin", tenantId: "dss-motor" });
      const response = await middleware(buildRequest("/api/superadmin/tenants"));
      expect(response.status).toBe(200);
    });
  });
});
