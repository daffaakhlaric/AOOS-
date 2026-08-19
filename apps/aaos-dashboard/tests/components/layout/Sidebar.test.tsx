import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

import { NAV_ITEMS, Sidebar } from "@/components/layout/Sidebar";

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

  it("renders Overview as a standalone item with NO section header above it", () => {
    render(<Sidebar />);
    // Overview has no group label rendered as a button before it — it sits directly under the
    // logo, distinct from the 4 real collapsible section headers below.
    const overviewLink = screen.getByRole("link", { name: /Overview/ });
    const sectionButtons = screen.getAllByRole("button");
    expect(sectionButtons).toHaveLength(4);
    for (const button of sectionButtons) {
      expect(button.compareDocumentPosition(overviewLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        0,
      );
    }
  });

  it("has an accessible navigation landmark", () => {
    render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: "Navigasi utama" })).toBeInTheDocument();
  });

  it("renders the 4 collapsible section headers: TAMARA / JESSY / KAI / OPERASIONAL", () => {
    render(<Sidebar />);
    expect(screen.getByText("TAMARA (META ADS)")).toBeInTheDocument();
    expect(screen.getByText("JESSY (SALES AI)")).toBeInTheDocument();
    expect(screen.getByText("KAI (CREATIVE)")).toBeInTheDocument();
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

  it("renders the 5 Jessy pages under the JESSY group at their new /jessy/* paths", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Analytics/ })).toHaveAttribute(
      "href",
      "/jessy/analytics",
    );
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("href", "/jessy/inbox");
    expect(screen.getByRole("link", { name: /Contacts/ })).toHaveAttribute(
      "href",
      "/jessy/contacts",
    );
    expect(screen.getByRole("link", { name: /Knowledge Base/ })).toHaveAttribute(
      "href",
      "/jessy/knowledge",
    );
    expect(screen.getByRole("link", { name: /^Simulator$/ })).toHaveAttribute(
      "href",
      "/jessy/simulator",
    );
  });

  it("does NOT render a /leads link anywhere (retired route)", () => {
    render(<Sidebar />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(hrefs).not.toContain("/leads");
    expect(hrefs.some((href) => href === "/knowledge")).toBe(false);
    expect(hrefs.some((href) => href === "/simulator")).toBe(false);
  });

  it("renders Creative Review, Scraper Mobix, and Asset Library under the KAI group", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Creative Review/ })).toHaveAttribute(
      "href",
      "/creative",
    );
    expect(screen.getByRole("link", { name: /Scraper Mobix/ })).toHaveAttribute(
      "href",
      "/assets/scraper",
    );
    expect(screen.getByRole("link", { name: /Asset Library/ })).toHaveAttribute(
      "href",
      "/assets/library",
    );
  });

  it("renders Objective, Branch Settings, Go Live Monitor, and Settings under the OPERASIONAL group", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Objective/ })).toHaveAttribute("href", "/objective");
    expect(screen.getByRole("link", { name: /Branch Settings/ })).toHaveAttribute(
      "href",
      "/branches",
    );
    expect(screen.getByRole("link", { name: /Go Live Monitor/ })).toHaveAttribute(
      "href",
      "/go-live",
    );
    const settingsLink = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("href") === "/settings");
    expect(settingsLink).toBeDefined();
    expect(settingsLink).toHaveTextContent("Settings");
  });

  it("does NOT add every desktop item to the mobile NAV_ITEMS list, and swaps the retired Leads entry for the Jessy Inbox", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(hrefs).not.toContain("/assets/scraper");
    expect(hrefs).not.toContain("/assets/library");
    expect(hrefs).not.toContain("/leads");
    expect(hrefs).toContain("/jessy/inbox");
  });
});
