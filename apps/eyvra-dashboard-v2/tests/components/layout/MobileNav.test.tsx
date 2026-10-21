import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/command-center",
}));

import { MobileNav } from "@/components/layout/MobileNav";

describe("MobileNav", () => {
  it("renders the MVP nav items with Command Center active", () => {
    render(<MobileNav />);
    const active = screen.getByText("Command Center");
    expect(active.closest("a")).toHaveAttribute("aria-current", "page");
  });
});
