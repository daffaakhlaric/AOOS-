import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/components/assets/AssetLibraryClient", () => ({
  AssetLibraryClient: () => <div data-testid="real-asset-library-client" />,
}));
vi.mock("@/components/meta-ads/AnalyticsHeatmapClient", () => ({
  AnalyticsHeatmapClient: () => <div data-testid="real-analytics-heatmap-client" />,
}));
vi.mock("@/components/listings/ListingsClient", () => ({
  ListingsClient: () => <div data-testid="real-listings-client" />,
}));
vi.mock("@/components/creative/CreativeClient", () => ({
  CreativeClient: () => <div data-testid="real-creative-client" />,
}));
vi.mock("@/components/creative/AnglePerformanceClient", () => ({
  AnglePerformanceClient: () => <div data-testid="real-angle-performance-client" />,
}));
vi.mock("@/components/creative/AssetPerformanceClient", () => ({
  AssetPerformanceClient: () => <div data-testid="real-asset-performance-client" />,
}));

import { CreativeHubClient } from "@/components/creative/CreativeHubClient";

describe("CreativeHubClient (EYVRA MENU RESTRUCTURE Sprint 2, /creative)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the 'assets' tab and renders the real AssetLibraryClient", () => {
    render(<CreativeHubClient />);
    expect(screen.getByTestId("creative-tab-assets")).toBeInTheDocument();
    expect(screen.getByTestId("real-asset-library-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=ab-results (Sprint 1's real /meta-ads/analytics/heatmap redirect target) and renders AnalyticsHeatmapClient", () => {
    render(<CreativeHubClient initialTab="ab-results" />);
    expect(screen.getByTestId("real-analytics-heatmap-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=listing (Sprint 1's real /listings redirect target) and renders ListingsClient", () => {
    render(<CreativeHubClient initialTab="listing" />);
    expect(screen.getByTestId("real-listings-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=review-kai and renders the real CreativeClient (old Creative Review, kept as an explicit tab)", () => {
    render(<CreativeHubClient initialTab="review-kai" />);
    expect(screen.getByTestId("real-creative-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=angle-performance and renders the real AnglePerformanceClient", () => {
    render(<CreativeHubClient initialTab="angle-performance" />);
    expect(screen.getByTestId("real-angle-performance-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=asset-performance and renders the real AssetPerformanceClient", () => {
    render(<CreativeHubClient initialTab="asset-performance" />);
    expect(screen.getByTestId("real-asset-performance-client")).toBeInTheDocument();
  });

  it("an unknown ?tab= value falls back to the default 'assets' tab", () => {
    render(<CreativeHubClient initialTab="not-a-real-tab" />);
    expect(screen.getByTestId("creative-tab-assets")).toBeInTheDocument();
  });

  it("clicking a tab switches the rendered body and updates the URL via router.replace", async () => {
    render(<CreativeHubClient />);
    await userEvent.click(screen.getByTestId("hub-tab-listing"));
    expect(screen.getByTestId("creative-tab-listing")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/creative?tab=listing", { scroll: false });
  });

  it("'Brief ke Kai ↗' links to the real review-kai tab (CreativeClient's own 'Buat Manual' brief form)", () => {
    render(<CreativeHubClient />);
    expect(screen.getByText("Brief ke Kai ↗")).toHaveAttribute("href", "/creative?tab=review-kai");
  });
});
