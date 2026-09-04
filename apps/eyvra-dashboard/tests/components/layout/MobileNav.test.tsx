import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/campaigns",
}));

import { MobileNav } from "@/components/layout/MobileNav";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 — `NAV_ITEMS` (from the rebuilt `Sidebar.tsx`) is now the flat
 * 7-item [Overview, Campaign, Leads, Creative, Aktivitas, AI Improve, Setting] list, so the first
 * 5 slots `MobileNav` renders are Overview/Campaign/Leads/Creative/Aktivitas — "AI Improve" and
 * "Setting" fall outside the `[0, 5)` slice.
 */
describe("MobileNav", () => {
  it("renders only the first 5 nav items", () => {
    render(<MobileNav />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Campaign")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByText("Creative")).toBeInTheDocument();
    expect(screen.getByText("Aktivitas")).toBeInTheDocument();
    expect(screen.queryByText("AI Improve")).not.toBeInTheDocument();
    expect(screen.queryByText("Setting")).not.toBeInTheDocument();
  });

  it("marks the current route as current", () => {
    render(<MobileNav />);
    expect(screen.getByRole("link", { name: /Campaign/ })).toHaveAttribute("aria-current", "page");
  });

  it("has an accessible mobile navigation landmark", () => {
    render(<MobileNav />);
    expect(screen.getByRole("navigation", { name: "Navigasi mobile" })).toBeInTheDocument();
  });
});
