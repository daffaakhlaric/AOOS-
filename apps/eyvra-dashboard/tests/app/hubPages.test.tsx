import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 — real `page.tsx` Server Components for the 3 new hub routes.
 * Asserts the real `searchParams.tab` (+ `/leads`'s `lead`, `/creative`'s `listingId`) prop
 * read server-side is threaded down to each real Hub Client component untouched, same
 * server-reads-once convention `ClaraInboxPage`'s own `initialLeadId` already established.
 */
vi.mock("@/components/campaigns/CampaignsHubClient", () => ({
  CampaignsHubClient: ({ initialTab }: { readonly initialTab?: string }) => (
    <div data-testid="campaigns-hub-client">{initialTab ?? "undefined"}</div>
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

import CampaignsPage from "@/app/(app)/campaigns/page";
import CreativePage from "@/app/(app)/creative/page";
import LeadsPage from "@/app/(app)/leads/page";

describe("Sprint 2 real hub pages — searchParams threading", () => {
  it("/campaigns passes searchParams.tab through to CampaignsHubClient", () => {
    render(<CampaignsPage searchParams={{ tab: "verdict" }} />);
    expect(screen.getByTestId("campaigns-hub-client")).toHaveTextContent("verdict");
  });

  it("/campaigns with no tab passes undefined (defaults inside the client)", () => {
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
});
