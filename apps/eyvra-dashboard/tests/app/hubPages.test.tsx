import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 — real `page.tsx` Server Components for the 3 new hub routes.
 * Asserts the real `searchParams.tab` (+ `/leads`'s `lead`, `/creative`'s `listingId`) prop
 * read server-side is threaded down to each real Hub Client component untouched, same
 * server-reads-once convention `ClaraInboxPage`'s own `initialLeadId` already established.
 */
vi.mock("@/components/campaigns/CampaignsHubClient", () => ({
  CampaignsHubClient: ({ initialView }: { readonly initialView?: string }) => (
    <div data-testid="campaigns-hub-client">{initialView ?? "undefined"}</div>
  ),
}));
vi.mock("@/components/leads/LeadsHubClient", () => ({
  LeadsHubClient: ({
    initialTab,
    initialLeadId,
  }: {
    readonly initialTab?: string;
    readonly initialLeadId?: string;
  }) => (
    <div data-testid="leads-hub-client">
      {initialTab ?? "undefined"}/{initialLeadId ?? "undefined"}
    </div>
  ),
}));
vi.mock("@/components/creative/CreativeHubClient", () => ({
  CreativeHubClient: ({ initialTab }: { readonly initialTab?: string }) => (
    <div data-testid="creative-hub-client">{initialTab ?? "undefined"}</div>
  ),
}));
// EYVRA MENU RESTRUCTURE Sprint 3 — same real server-reads-once convention for the new Settings hub.
vi.mock("@/components/settings/SettingsHubClient", () => ({
  SettingsHubClient: ({ initialTab }: { readonly initialTab?: string }) => (
    <div data-testid="settings-hub-client">{initialTab ?? "undefined"}</div>
  ),
}));
// EYVRA SAMANTHA V2 + KAI V2 Phase 53 (PROMPT 84) — real dedicated `/experiments` page, reusing
// `AbTestingClient` wholesale (no props — mocked here purely to isolate this page-shell test from
// that component's own real data-fetching, already covered by `AbTestingClient.test.tsx`).
vi.mock("@/components/meta-ads/AbTestingClient", () => ({
  AbTestingClient: () => <div data-testid="abtesting-client" />,
}));

import CampaignsPage from "@/app/(app)/campaigns/page";
import CreativePage from "@/app/(app)/creative/page";
import ExperimentsPage from "@/app/(app)/experiments/page";
import LeadsPage from "@/app/(app)/leads/page";
import SettingsPage from "@/app/(app)/settings/page";

describe("Sprint 2 real hub pages — searchParams threading", () => {
  it("/campaigns passes searchParams.view through to CampaignsHubClient (AAOS-CAMPAIGNS-UNIFIED-PAGE's real ?view=ab-testing escape hatch)", () => {
    render(<CampaignsPage searchParams={{ view: "ab-testing" }} />);
    expect(screen.getByTestId("campaigns-hub-client")).toHaveTextContent("ab-testing");
  });

  it("/campaigns with no view passes undefined (renders the unified page by default)", () => {
    render(<CampaignsPage searchParams={{}} />);
    expect(screen.getByTestId("campaigns-hub-client")).toHaveTextContent("undefined");
  });

  it("/leads passes both searchParams.tab and searchParams.lead through", () => {
    render(<LeadsPage searchParams={{ tab: "inbox", lead: "lead-9" }} />);
    expect(screen.getByTestId("leads-hub-client")).toHaveTextContent("inbox/lead-9");
  });

  it("/creative passes searchParams.tab through when present", () => {
    render(<CreativePage searchParams={{ tab: "listing" }} />);
    expect(screen.getByTestId("creative-hub-client")).toHaveTextContent("listing");
  });

  it("/creative with ?listingId= and no explicit tab defaults to 'review-kai' (the real Brief-ke-Kai flow)", () => {
    render(<CreativePage searchParams={{ listingId: "listing-7" }} />);
    expect(screen.getByTestId("creative-hub-client")).toHaveTextContent("review-kai");
  });

  it("/creative with ?listingId= AND an explicit tab respects the explicit tab", () => {
    render(<CreativePage searchParams={{ listingId: "listing-7", tab: "assets" }} />);
    expect(screen.getByTestId("creative-hub-client")).toHaveTextContent("assets");
  });

  it("/settings passes searchParams.tab through to SettingsHubClient", () => {
    render(<SettingsPage searchParams={{ tab: "koneksi" }} />);
    expect(screen.getByTestId("settings-hub-client")).toHaveTextContent("koneksi");
  });

  it("/settings with no tab passes undefined (defaults inside the client)", () => {
    render(<SettingsPage searchParams={{}} />);
    expect(screen.getByTestId("settings-hub-client")).toHaveTextContent("undefined");
  });

  it("/experiments renders a real TopBar + the real AbTestingClient (Phase 53, PROMPT 84 — no longer a redirect)", () => {
    render(<ExperimentsPage />);
    expect(screen.getByRole("heading", { name: "Experiments" })).toBeInTheDocument();
    expect(screen.getByTestId("abtesting-client")).toBeInTheDocument();
  });
});
