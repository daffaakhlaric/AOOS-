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

  it("falls back to '/' when NEXT_PUBLIC_CRM_URL is not set", async () => {
    delete process.env["NEXT_PUBLIC_CRM_URL"];
    getSession.mockResolvedValue({ userId: "u1", role: "sales" });
    const response = await middleware(buildRequest("/dashboard"));
    expect(response.headers.get("location")).toBe("http://localhost:3001/");
  });

  it("allows a manager/owner session through", async () => {
    getSession.mockResolvedValue({ userId: "u1", role: "manager" });
    const response = await middleware(buildRequest("/dashboard"));
    expect(response.status).toBe(200);
  });
});
