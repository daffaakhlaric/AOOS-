import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/objective",
}));

import { MobileNav } from "@/components/layout/MobileNav";

describe("MobileNav", () => {
  it("renders only the first 5 nav items", () => {
    render(<MobileNav />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.queryByText("Simulator")).not.toBeInTheDocument();
  });

  it("marks the current route as current", () => {
    render(<MobileNav />);
    expect(screen.getByRole("link", { name: /Objective/ })).toHaveAttribute("aria-current", "page");
  });

  it("has an accessible mobile navigation landmark", () => {
    render(<MobileNav />);
    expect(screen.getByRole("navigation", { name: "Navigasi mobile" })).toBeInTheDocument();
  });
});
