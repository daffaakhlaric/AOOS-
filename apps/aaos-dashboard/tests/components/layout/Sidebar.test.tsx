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

  it("renders the grouped TAMARA (META ADS) / OPERASIONAL section headers", () => {
    render(<Sidebar />);
    expect(screen.getByText("TAMARA (META ADS)")).toBeInTheDocument();
    expect(screen.getByText("OPERASIONAL")).toBeInTheDocument();
  });

  it("renders all 4 new Tamara/Meta-Ads pages under the TAMARA group", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Audit Biaya/ })).toHaveAttribute(
      "href",
      "/meta-ads/audit",
    );
    expect(screen.getByRole("link", { name: /Analisa & Rekomendasi/ })).toHaveAttribute(
      "href",
      "/meta-ads/analisa",
    );
    expect(screen.getByRole("link", { name: /Strategi & Approve/ })).toHaveAttribute(
      "href",
      "/meta-ads/strategi",
    );
    expect(screen.getByRole("link", { name: /Simulasi Tamara × Kai/ })).toHaveAttribute(
      "href",
      "/meta-ads/simulasi",
    );
  });

  it("renders Simulator (Jessy) under the OPERASIONAL group", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Simulator \(Jessy\)/ })).toHaveAttribute(
      "href",
      "/simulator",
    );
  });
});
