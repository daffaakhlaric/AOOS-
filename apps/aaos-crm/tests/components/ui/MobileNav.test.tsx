import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/leads" }));

import { MobileNav } from "@/components/ui/MobileNav";

describe("MobileNav", () => {
  it("renders all 4 nav items", () => {
    render(<MobileNav />);
    expect(screen.getByText("Hot Leads")).toBeInTheDocument();
    expect(screen.getByText("Leads Saya")).toBeInTheDocument();
    expect(screen.getByText("Closing")).toBeInTheDocument();
    expect(screen.getByText("Statistik")).toBeInTheDocument();
  });

  it("marks the current route as aria-current=page", () => {
    render(<MobileNav />);
    expect(screen.getByText("Hot Leads").closest("a")).toHaveAttribute("aria-current", "page");
  });

  it("does not mark other routes as current", () => {
    render(<MobileNav />);
    expect(screen.getByText("Statistik").closest("a")).not.toHaveAttribute("aria-current");
  });
});
