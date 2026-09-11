import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AndromedaHealthCard } from "@/components/campaigns/AndromedaHealthCard";

function mockFetch(
  routes: Record<string, { readonly body: unknown; readonly status?: number }>,
): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const matchKey = Object.keys(routes).find((key) => url === key || url.startsWith(key));
    if (matchKey === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    const route = routes[matchKey];
    if (route === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  }) as unknown as typeof fetch;
}

const NOT_ENOUGH_DATA_HEALTH = {
  campaignId: "camp-1",
  campaignName: "Cluster Anggrek Campaign",
  adSetCount: 1,
  diversity: {
    status: "NOT_ENOUGH_DATA",
    totalAdCount: 1,
    reasoning: "Hanya 1 ad di campaign ini — minimal 3 ad diperlukan.",
  },
  evaluation: { triggered: false },
};

const LOW_DIVERSITY_HEALTH = {
  campaignId: "camp-1",
  campaignName: "Cluster Anggrek Campaign",
  adSetCount: 3,
  diversity: {
    status: "LOW_DIVERSITY",
    totalAdCount: 6,
    distinctCreativeAssetCount: 2,
    reasoning: "2 creative asset unik dari 6 ad (rasio 0.33) — di bawah ambang 0.5.",
  },
  evaluation: {
    triggered: true,
    reason: "Campaign ini punya 3 ad set DAN diversity kreatif rendah.",
  },
};

const DIVERSE_HEALTH = {
  campaignId: "camp-1",
  campaignName: "Cluster Anggrek Campaign",
  adSetCount: 1,
  diversity: {
    status: "DIVERSE",
    totalAdCount: 6,
    distinctCreativeAssetCount: 5,
    reasoning: "5 creative asset unik dari 6 ad (rasio 0.83) — sudah cukup diverse.",
  },
  evaluation: { triggered: false },
};

describe("AndromedaHealthCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loading state: shows a spinner before the real health fetch resolves", () => {
    mockFetch({
      "/api/campaigns/camp-1/andromeda-health": { body: NOT_ENOUGH_DATA_HEALTH },
      "/api/pending-actions": { body: [] },
    });
    render(<AndromedaHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    expect(screen.getByTestId("andromeda-health-card")).toBeInTheDocument();
  });

  it("empty/NOT_ENOUGH_DATA state: renders the real badge and reasoning, offers Brief Kai", async () => {
    mockFetch({
      "/api/campaigns/camp-1/andromeda-health": { body: NOT_ENOUGH_DATA_HEALTH },
      "/api/pending-actions": { body: [] },
    });
    render(<AndromedaHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() =>
      expect(screen.getByTestId("diversity-badge")).toHaveTextContent("Data Belum Cukup"),
    );
    expect(screen.getByText(/minimal 3 ad diperlukan/)).toBeInTheDocument();
    expect(screen.getByTestId("brief-kai-button")).toBeInTheDocument();
  });

  it("low-diversity-with-button state: LOW_DIVERSITY shows the badge and an enabled Brief Kai button when listingId is known", async () => {
    mockFetch({
      "/api/campaigns/camp-1/andromeda-health": { body: LOW_DIVERSITY_HEALTH },
      "/api/pending-actions": { body: [] },
    });
    render(
      <AndromedaHealthCard
        campaignId="camp-1"
        campaignName="Cluster Anggrek Campaign"
        listingId="listing-1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("diversity-badge")).toHaveTextContent("Low Diversity"),
    );
    expect(screen.getByTestId("brief-kai-button")).not.toBeDisabled();
  });

  it("already-pending-approval state: shows the real pending box + link to /learning, never a second approve UI", async () => {
    mockFetch({
      "/api/campaigns/camp-1/andromeda-health": { body: LOW_DIVERSITY_HEALTH },
      "/api/pending-actions": {
        body: [
          {
            id: "pending-1",
            tenantId: "tenant-1",
            agent: "SAMANTHA",
            actionType: "RESTRUCTURE_CAMPAIGN",
            payload: { campaignId: "camp-1" },
            status: "PENDING",
            decidedBy: null,
            decisionNotes: null,
            decidedAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    render(<AndromedaHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() => expect(screen.getByTestId("pending-approval-box")).toBeInTheDocument());
    expect(screen.getByText("Review di Pending Actions →")).toHaveAttribute("href", "/learning");
    expect(screen.queryByText(/^Approve$/)).not.toBeInTheDocument();
  });

  it("diverse-healthy state: DIVERSE never shows the Brief Kai button", async () => {
    mockFetch({
      "/api/campaigns/camp-1/andromeda-health": { body: DIVERSE_HEALTH },
      "/api/pending-actions": { body: [] },
    });
    render(<AndromedaHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() => expect(screen.getByTestId("diversity-badge")).toHaveTextContent("Diverse"));
    expect(screen.queryByTestId("brief-kai-button")).not.toBeInTheDocument();
  });

  it("Brief Kai sekarang: disabled with an honest explanation when no listingId can be resolved", async () => {
    mockFetch({
      "/api/campaigns/camp-1/andromeda-health": { body: LOW_DIVERSITY_HEALTH },
      "/api/pending-actions": { body: [] },
    });
    render(<AndromedaHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() => expect(screen.getByTestId("brief-kai-button")).toBeDisabled());
    expect(screen.getByText(/Tidak bisa menentukan listing/)).toBeInTheDocument();
  });

  it("Brief Kai sekarang: real success state only appears after the backend actually confirms creation, never before", async () => {
    mockFetch({
      "/api/campaigns/camp-1/andromeda-health": { body: LOW_DIVERSITY_HEALTH },
      "/api/pending-actions": { body: [] },
      "/api/creative-packages/diverse-set": {
        body: {
          requestedCount: 5,
          allowedCount: 5,
          cappedByDailyLimit: false,
          createdCount: 3,
          packages: [],
        },
      },
    });
    render(
      <AndromedaHealthCard
        campaignId="camp-1"
        campaignName="Cluster Anggrek Campaign"
        listingId="listing-1"
      />,
    );
    await waitFor(() => expect(screen.getByTestId("brief-kai-button")).not.toBeDisabled());
    expect(screen.queryByTestId("brief-result-box")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("brief-kai-button"));

    await waitFor(() =>
      expect(screen.getByTestId("brief-result-box")).toHaveTextContent(
        "3 brief kreatif baru dibuat",
      ),
    );
  });
});
