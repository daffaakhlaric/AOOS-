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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes /login through without checking session", async () => {
    const response = await middleware(buildRequest("/login"));
    expect(getSession).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("redirects to /login when there is no session, preserving redirectedFrom", async () => {
    getSession.mockResolvedValue(null);
    const response = await middleware(buildRequest("/inbox"));
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirectedFrom=%2Finbox");
  });

  it("allows a valid session through", async () => {
    getSession.mockResolvedValue({ userId: "u1", salesHumanId: "sales-rina" });
    const response = await middleware(buildRequest("/inbox"));
    expect(response.status).toBe(200);
  });

  it("redirects the retired /leads route to /inbox without checking session", async () => {
    const response = await middleware(buildRequest("/leads"));
    expect(getSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/inbox");
  });

  it("redirects /leads/:leadId to bare /inbox (no per-conversation URL segment exists)", async () => {
    const response = await middleware(buildRequest("/leads/lead-123"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/inbox");
  });
});
