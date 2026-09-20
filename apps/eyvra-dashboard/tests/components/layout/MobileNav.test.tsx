import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/campaigns",
}));

import { MobileNav } from "@/components/layout/MobileNav";

/**
 * EYVRA SAMANTHA V2 + KAI V2 Phase 50 (PROMPT 68) — `NAV_ITEMS` (from the rebuilt `Sidebar.tsx`) is
 * now the flat 8-item [Command Center, Campaigns, Leads, Kai Studio, Experiments, Automation,
 * Activity, Setting] list, so the first 5 slots `MobileNav` renders are Command Center/Campaigns/
 * Leads/Kai Studio/Experiments — "Automation"/"Activity"/"Setting" fall outside the `[0, 5)` slice.
 */
describe("MobileNav", () => {
  it("renders only the first 5 nav items", () => {
    render(<MobileNav />);
    expect(screen.getByText("Command Center")).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByText("Kai Studio")).toBeInTheDocument();
    expect(screen.getByText("Experiments")).toBeInTheDocument();
    expect(screen.queryByText("Automation")).not.toBeInTheDocument();
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Setting")).not.toBeInTheDocument();
  });

  it("marks the current route as current", () => {
    render(<MobileNav />);
    expect(screen.getByRole("link", { name: /Campaigns/ })).toHaveAttribute("aria-current", "page");
  });

  it("has an accessible mobile navigation landmark", () => {
    render(<MobileNav />);
    expect(screen.getByRole("navigation", { name: "Navigasi mobile" })).toBeInTheDocument();
  });
});
