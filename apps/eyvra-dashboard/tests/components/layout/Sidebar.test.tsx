import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let currentPathname = "/command-center";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

import { MENU, NAV_ITEMS, SETTINGS_ITEM, Sidebar } from "@/components/layout/Sidebar";

/**
 * EYVRA SAMANTHA V2 + KAI V2 Phase 50 (PROMPT 68) — rewritten for the 8-item nav from the user's own
 * real reference screenshots: Command Center, Campaigns, Leads, Kai Studio, Experiments, Automation,
 * Activity, Settings. See `Sidebar.tsx`'s own class doc for the full real route-mapping rationale.
 */
describe("Sidebar", () => {
  const EXPECTED_ROUTES: ReadonlyArray<readonly [label: string, href: string]> = [
    ["Command Center", "/command-center"],
    ["Campaigns", "/campaigns"],
    ["Leads", "/leads"],
    ["Kai Studio", "/creative"],
    ["Experiments", "/experiments"],
    ["Automation", "/automation"],
    ["Activity", "/activity"],
    ["Setting", "/settings"],
  ];

  it("exposes exactly 8 nav items in NAV_ITEMS, in the spec's order", () => {
    expect(NAV_ITEMS).toHaveLength(8);
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(EXPECTED_ROUTES.map(([label]) => label));
  });

  it("MENU holds the first 7 items (everything except Setting, which renders separately)", () => {
    expect(MENU).toHaveLength(7);
    expect(SETTINGS_ITEM.label).toBe("Setting");
    expect(SETTINGS_ITEM.href).toBe("/settings");
  });

  it("renders all 8 menu items with the correct label and href, and no old section headers", () => {
    currentPathname = "/command-center";
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
    const campaignLink = screen.getByText("Campaigns").closest("a");
    expect(campaignLink).toHaveAttribute("aria-current", "page");
    expect(campaignLink?.className).toMatch(/navItemActive/);

    const commandCenterLink = screen.getByText("Command Center").closest("a");
    expect(commandCenterLink).not.toHaveAttribute("aria-current");
    expect(commandCenterLink?.className ?? "").not.toMatch(/navItemActive/);
  });

  it("treats a nested path under a menu route as active too (e.g. /leads/123 activates Leads)", () => {
    currentPathname = "/leads/123";
    render(<Sidebar />);
    const leadsLink = screen.getByText("Leads").closest("a");
    expect(leadsLink).toHaveAttribute("aria-current", "page");
  });

  it("renders the logo mark as a plain 'E' (Eyvra rebrand), not the old 'AAOS' wordmark", () => {
    currentPathname = "/command-center";
    render(<Sidebar />);
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.queryByText("AAOS")).not.toBeInTheDocument();
  });

  it("has an accessible desktop navigation landmark", () => {
    currentPathname = "/command-center";
    render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: "Navigasi utama" })).toBeInTheDocument();
  });
});
