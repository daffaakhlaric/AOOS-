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

  it("redirects /leads to /jessy/inbox without checking session (MENU RESTRUCTURE FINAL)", async () => {
    const response = await middleware(buildRequest("/leads"));
    expect(getSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/jessy/inbox");
  });

  it("redirects /knowledge to /jessy/knowledge", async () => {
    const response = await middleware(buildRequest("/knowledge"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/jessy/knowledge");
  });

  it("redirects /simulator to /jessy/simulator", async () => {
    const response = await middleware(buildRequest("/simulator"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/jessy/simulator");
  });

  it("does NOT redirect a nested path like /leads/abc — only the exact /leads path", async () => {
    getSession.mockResolvedValue({ userId: "u1", role: "manager" });
    const response = await middleware(buildRequest("/leads/abc"));
    expect(response.status).toBe(200);
  });
});
