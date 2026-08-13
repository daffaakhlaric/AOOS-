import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { Sidebar } from "@/components/layout/Sidebar";

describe("Sidebar", () => {
  it("renders every nav item's label", () => {
    render(<Sidebar />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Data Iklan")).toBeInTheDocument();
    expect(screen.getByText("Creative Review")).toBeInTheDocument();
    expect(screen.getByText("Branch Settings")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Base")).toBeInTheDocument();
  });

  it("marks the current route's link as the current page", () => {
    render(<Sidebar />);
    const link = screen.getByRole("link", { name: /Overview/ });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("has an accessible navigation landmark", () => {
    render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: "Navigasi utama" })).toBeInTheDocument();
  });
});
