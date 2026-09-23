import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/command-center",
}));

import { Sidebar } from "@/components/layout/Sidebar";

describe("Sidebar", () => {
  it("renders the real Command Center link as active and clickable", () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /Command Center/i });
    expect(link).toHaveAttribute("href", "/command-center");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("links other destinations to V2 placeholders", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Campaigns/i })).toHaveAttribute("href", "/campaigns");
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
  });

  it("collapses and expands via the real toggle button", async () => {
    const { container } = render(<Sidebar />);
    const toggle = screen.getByRole("button", { name: /Ciutkan sidebar/i });
    fireEvent.click(toggle);
    expect(container.querySelector('[class*="sidebarCollapsed"]')).not.toBeNull();
  });
});
