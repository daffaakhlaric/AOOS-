import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let currentPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

import { MENU, NAV_ITEMS, SETTINGS_ITEM, Sidebar } from "@/components/layout/Sidebar";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 — full rewrite replacing the old grouped/collapsible/
 * per-vertical Sidebar tests: the new Sidebar is a flat, vertical-agnostic 7-item rail with no
 * section headers, no collapse state, and no `/api/settings` fetch (see `Sidebar.tsx`'s class
 * doc for why the vertical fetch was removed entirely, not just untested).
 */
describe("Sidebar", () => {
  const EXPECTED_ROUTES: ReadonlyArray<readonly [label: string, href: string]> = [
    ["Overview", "/dashboard"],
    ["Campaign", "/campaigns"],
    ["Leads", "/leads"],
    ["Creative", "/creative"],
    ["Aktivitas", "/activity"],
    ["AI Improve", "/self-improve"],
    ["Setting", "/settings"],
  ];

  it("exposes exactly 7 nav items in NAV_ITEMS, in the spec's order", () => {
    expect(NAV_ITEMS).toHaveLength(7);
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(EXPECTED_ROUTES.map(([label]) => label));
  });

  it("MENU holds the first 6 items (everything except Setting, which renders separately)", () => {
    expect(MENU).toHaveLength(6);
    expect(SETTINGS_ITEM.label).toBe("Setting");
    expect(SETTINGS_ITEM.href).toBe("/settings");
  });

  it("renders all 7 menu items with the correct label and href, and no old section headers", () => {
    currentPathname = "/dashboard";
    render(<Sidebar />);
    for (const [label, href] of EXPECTED_ROUTES) {
      const link = screen.getByText(label).closest("a");
      expect(link).toHaveAttribute("href", href);
    }
    // The old 24-item sidebar's section headers must be completely gone.
    expect(screen.queryByText("SAMANTHA (META ADS)")).not.toBeInTheDocument();
    expect(screen.queryByText("CLARA (SALES AI)")).not.toBeInTheDocument();
    expect(screen.queryByText("KAI (CREATIVE)")).not.toBeInTheDocument();
    expect(screen.queryByText("OPERASIONAL")).not.toBeInTheDocument();
    expect(screen.queryByText("SOSIAL MEDIA")).not.toBeInTheDocument();
  });

  it("marks the active item (current route /campaigns) with the navItemActive styling hook, and only that one", () => {
    currentPathname = "/campaigns";
    render(<Sidebar />);
    const campaignLink = screen.getByText("Campaign").closest("a");
    expect(campaignLink).toHaveAttribute("aria-current", "page");
    expect(campaignLink?.className).toMatch(/navItemActive/);

    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink).not.toHaveAttribute("aria-current");
    expect(overviewLink?.className ?? "").not.toMatch(/navItemActive/);
  });

  it("treats a nested path under a menu route as active too (e.g. /leads/123 activates Leads)", () => {
    currentPathname = "/leads/123";
    render(<Sidebar />);
    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink).toHaveAttribute("aria-current", "page");
  });

  it("renders the logo mark as a plain 'E' (Eyvra rebrand), not the old 'AAOS' wordmark", () => {
    currentPathname = "/dashboard";
    render(<Sidebar />);
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.queryByText("AAOS")).not.toBeInTheDocument();
  });

  it("has an accessible desktop navigation landmark", () => {
    currentPathname = "/dashboard";
    render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: "Navigasi utama" })).toBeInTheDocument();
  });
});
