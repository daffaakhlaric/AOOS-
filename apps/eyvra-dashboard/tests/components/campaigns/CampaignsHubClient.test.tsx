import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

/**
 * Every tab body is a REAL, already-independently-tested Client component (each has its own
 * `tests/components/meta-ads/*Client.test.tsx` / `tests/components/objective/ObjectiveClient.
 * test.tsx` suite exercising its actual data-fetching/rendering behavior). This hub-level suite's
 * job is proving the HUB's own real logic — which real component mounts per tab, and that
 * `?tab=` deep-linking matches Sprint 1's own redirect targets — so each heavy real component is
 * mocked here to a recognizable marker, isolating that routing logic from its own dependencies.
 */
vi.mock("@/components/meta-ads/MetaAdsClient", () => ({
  MetaAdsClient: () => <div data-testid="real-meta-ads-client" />,
}));
vi.mock("@/components/meta-ads/LookalikeClient", () => ({
  LookalikeClient: () => <div data-testid="real-lookalike-client" />,
}));
vi.mock("@/components/meta-ads/StrategiClient", () => ({
  StrategiClient: () => <div data-testid="real-strategi-client" />,
}));
vi.mock("@/components/meta-ads/AnalisaClient", () => ({
  AnalisaClient: () => <div data-testid="real-analisa-client" />,
}));
vi.mock("@/components/meta-ads/AbTestingClient", () => ({
  AbTestingClient: () => <div data-testid="real-abtesting-client" />,
}));
vi.mock("@/components/meta-ads/AuditClient", () => ({
  AuditClient: () => <div data-testid="real-audit-client" />,
}));
vi.mock("@/components/objective/ObjectiveClient", () => ({
  ObjectiveClient: () => <div data-testid="real-objective-client" />,
}));
vi.mock("@/components/campaigns/MetricsTab", () => ({
  MetricsTab: () => <div data-testid="real-metrics-tab" />,
}));

import { CampaignsHubClient } from "@/components/campaigns/CampaignsHubClient";

function mockFetchOnce(body: unknown): void {
  global.fetch = vi.fn(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  ) as unknown as typeof fetch;
}

describe("CampaignsHubClient (EYVRA MENU RESTRUCTURE Sprint 2, /campaigns)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the 'aktif' tab and renders the real MetaAdsClient + LookalikeClient", () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient />);
    expect(screen.getByTestId("campaigns-tab-aktif")).toBeInTheDocument();
    expect(screen.getByTestId("real-meta-ads-client")).toBeInTheDocument();
    expect(screen.getByTestId("real-lookalike-client")).toBeInTheDocument();
  });

  it("Sprint 5 Prompt 13: 'metrics' is the FIRST tab in the nav and deep-links to ?tab=metrics, rendering the real MetricsTab", () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient initialTab="metrics" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("Metrics");
    expect(screen.getByTestId("campaigns-tab-metrics")).toBeInTheDocument();
    expect(screen.getByTestId("real-metrics-tab")).toBeInTheDocument();
  });

  it("deep-links to ?tab=verdict (Sprint 1's real /meta-ads/analisa + /meta-ads/strategi redirect target) and renders StrategiClient + AnalisaClient", () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient initialTab="verdict" />);
    expect(screen.getByTestId("campaigns-tab-verdict")).toBeInTheDocument();
    expect(screen.getByTestId("real-strategi-client")).toBeInTheDocument();
    expect(screen.getByTestId("real-analisa-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=ab (Sprint 1's real /meta-ads/abtesting redirect target) and renders AbTestingClient", () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient initialTab="ab" />);
    expect(screen.getByTestId("real-abtesting-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=anggaran (Sprint 1's real /meta-ads/audit redirect target) and renders AuditClient", () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient initialTab="anggaran" />);
    expect(screen.getByTestId("real-audit-client")).toBeInTheDocument();
  });

  it("deep-links to ?tab=objective and renders the real ObjectiveClient", () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient initialTab="objective" />);
    expect(screen.getByTestId("real-objective-client")).toBeInTheDocument();
  });

  it("an unknown ?tab= value falls back to the default 'aktif' tab", () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient initialTab="not-a-real-tab" />);
    expect(screen.getByTestId("campaigns-tab-aktif")).toBeInTheDocument();
  });

  it("clicking a tab switches the rendered body and updates the URL via router.replace", async () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient />);
    await userEvent.click(screen.getByTestId("hub-tab-ab"));
    expect(screen.getByTestId("campaigns-tab-ab")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/campaigns?tab=ab", { scroll: false });
  });

  it("fetches /api/settings and renders the real DEV/LIVE mode badge", async () => {
    mockFetchOnce({ tenant: { mode: "LIVE" } });
    render(<CampaignsHubClient />);
    await waitFor(() => expect(screen.getByTestId("mode-badge")).toHaveTextContent("LIVE"));
  });

  it("'Jalankan loop ↗' links to the real /activity hub (SimulationWizardClient's new home)", () => {
    mockFetchOnce({ tenant: { mode: "DEV" } });
    render(<CampaignsHubClient />);
    expect(screen.getByText("Jalankan loop ↗")).toHaveAttribute("href", "/activity");
  });
});
