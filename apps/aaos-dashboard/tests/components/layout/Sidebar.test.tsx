import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { Sidebar } from "@/components/layout/Sidebar";

function mockSettingsFetch(vertical: "AUTOMOTIVE" | "PROPERTY" | undefined): void {
  global.fetch = vi.fn(async () =>
    vertical === undefined
      ? new Response(null, { status: 401 })
      : new Response(
          JSON.stringify({
            tenant: { tenantId: "t", name: "T", vertical, status: "ACTIVE" },
            meta: { apiVersion: "v21.0", hasToken: false, usingEnvDefault: true },
          }),
          { status: 200 },
        ),
  ) as unknown as typeof fetch;
}

describe("Sidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the AUTOMOTIVE nav (Scraper Mobix, plain KAI label) before the vertical is resolved", () => {
    mockSettingsFetch(undefined);
    render(<Sidebar />);
    expect(screen.getByText("KAI (CREATIVE)")).toBeInTheDocument();
    expect(screen.getByText("Scraper Mobix")).toBeInTheDocument();
    expect(screen.queryByText("Listing Manager")).not.toBeInTheDocument();
  });

  it("keeps the AUTOMOTIVE nav (Scraper Mobix) when the session's vertical is AUTOMOTIVE", async () => {
    mockSettingsFetch("AUTOMOTIVE");
    render(<Sidebar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/settings"));
    expect(screen.getByText("Scraper Mobix")).toBeInTheDocument();
    expect(screen.queryByText("Listing Manager")).not.toBeInTheDocument();
  });

  it("swaps to the PROPERTY nav (Listing Manager, relabeled KAI section) when the session's vertical is PROPERTY", async () => {
    mockSettingsFetch("PROPERTY");
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByText("Listing Manager")).toBeInTheDocument());
    expect(screen.getByText("KAI (CREATIVE) — PROPERTI")).toBeInTheDocument();
    expect(screen.queryByText("Scraper Mobix")).not.toBeInTheDocument();
    const link = screen.getByText("Listing Manager").closest("a");
    expect(link).toHaveAttribute("href", "/listings");
  });

  it("does NOT render Activity Log for AUTOMOTIVE (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B, PROPERTY-only)", async () => {
    mockSettingsFetch("AUTOMOTIVE");
    render(<Sidebar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/settings"));
    expect(screen.queryByText("Activity Log")).not.toBeInTheDocument();
  });

  it("renders Activity Log under OPERASIONAL for PROPERTY, linking to /property/activity", async () => {
    mockSettingsFetch("PROPERTY");
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByText("Activity Log")).toBeInTheDocument());
    const link = screen.getByText("Activity Log").closest("a");
    expect(link).toHaveAttribute("href", "/property/activity");
  });

  it("renders the Lead Recycling nav item under CLARA (SALES AI), for both verticals", () => {
    mockSettingsFetch(undefined);
    render(<Sidebar />);
    const link = screen.getByText("Lead Recycling").closest("a");
    expect(link).toHaveAttribute("href", "/clara/recycling");
  });

  it("renders the A/B Testing nav item under SAMANTHA (META ADS)", () => {
    mockSettingsFetch(undefined);
    render(<Sidebar />);
    const link = screen.getByText("A/B Testing").closest("a");
    expect(link).toHaveAttribute("href", "/meta-ads/abtesting");
  });

  it("renders the Lookalike Audience nav item under SAMANTHA (META ADS)", () => {
    mockSettingsFetch(undefined);
    render(<Sidebar />);
    const link = screen.getByText("Lookalike Audience").closest("a");
    expect(link).toHaveAttribute("href", "/meta-ads/lookalike");
  });

  it("renders the SOSIAL MEDIA section with its 6 sub-items (AAOS-SOSMED-AUTOMATION Phase 5)", () => {
    mockSettingsFetch(undefined);
    render(<Sidebar />);
    expect(screen.getByText("SOSIAL MEDIA")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Sosmed").closest("a")).toHaveAttribute("href", "/sosmed");
    expect(screen.getByText("Content Calendar").closest("a")).toHaveAttribute(
      "href",
      "/sosmed/calendar",
    );
    expect(screen.getByText("Content Studio").closest("a")).toHaveAttribute(
      "href",
      "/sosmed/studio",
    );
    expect(screen.getByText("Post Manager").closest("a")).toHaveAttribute("href", "/sosmed/posts");
    expect(screen.getByText("Analytics Sosmed").closest("a")).toHaveAttribute(
      "href",
      "/sosmed/analytics",
    );
    expect(screen.getByText("Akun Terhubung").closest("a")).toHaveAttribute(
      "href",
      "/sosmed/accounts",
    );
  });

  it("never breaks rendering when the settings fetch fails", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    render(<Sidebar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText("Scraper Mobix")).toBeInTheDocument();
  });
});
