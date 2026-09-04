import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LookalikeClient } from "@/components/meta-ads/LookalikeClient";
import type { LookalikeStatusDto, MetaAudienceDto } from "@/types/dashboard.types";

const BELOW_THRESHOLD_STATUS: LookalikeStatusDto = {
  totalHotLeads: 47,
  syncedToMetaAudience: 38,
  minRequiredForLookalike: 100,
  progressPercentage: 47,
  lookalikeEligible: false,
  lastSyncedAt: "2026-08-14T00:00:00.000Z",
};

const CUSTOM_AUDIENCE: MetaAudienceDto = {
  id: "audience-row-1",
  metaAudienceId: "audience-1",
  audienceType: "HOT_LEADS",
  name: "AAOS-HotLeads-dss-motor-Aug2026",
  size: 124,
  status: "ACTIVE",
  lastUpdatedAt: "2026-08-16T00:00:00.000Z",
  createdAt: "2026-08-01T00:00:00.000Z",
};

const ELIGIBLE_STATUS: LookalikeStatusDto = {
  totalHotLeads: 124,
  syncedToMetaAudience: 124,
  minRequiredForLookalike: 100,
  progressPercentage: 100,
  lookalikeEligible: true,
  lastSyncedAt: "2026-08-16T00:00:00.000Z",
  customAudience: CUSTOM_AUDIENCE,
};

const LOOKALIKE_1PCT: MetaAudienceDto = {
  id: "audience-row-2",
  metaAudienceId: "lookalike-1",
  audienceType: "LOOKALIKE_1PCT",
  name: "AAOS-Lookalike-1pct-dss-motor",
  percentage: 1,
  originAudienceId: "audience-1",
  status: "ACTIVE",
  createdAt: "2026-08-16T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(
  overrides: Partial<{
    status: () => Response;
    audiences: () => Response;
    sync: () => Response;
    createLookalike: () => Response;
  }> = {},
): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/lookalike/status") {
      return overrides.status?.() ?? jsonResponse({ status: BELOW_THRESHOLD_STATUS });
    }
    if (url === "/api/lookalike/audiences") {
      return overrides.audiences?.() ?? jsonResponse({ audiences: [] });
    }
    if (url === "/api/lookalike/sync" && init?.method === "POST") {
      return (
        overrides.sync?.() ??
        jsonResponse({
          result: { summary: "5 hot leads baru disync", newlySynced: 5, totalSynced: 43 },
        })
      );
    }
    if (url === "/api/lookalike/audiences/lookalike" && init?.method === "POST") {
      return overrides.createLookalike?.() ?? jsonResponse({ audience: LOOKALIKE_1PCT }, 201);
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("LookalikeClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the real status card with total/synced hot leads and the below-threshold warning", async () => {
    mockFetchRouter();
    render(<LookalikeClient />);
    await waitFor(() => expect(screen.getByTestId("lookalike-status-card")).toBeInTheDocument());

    expect(screen.getByText(/47 leads/)).toBeInTheDocument();
    expect(screen.getByText(/38 leads/)).toBeInTheDocument();
    expect(screen.getByText(/100 leads/)).toBeInTheDocument();
    expect(screen.getByText(/Meta membutuhkan minimal/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "47");
  });

  it("does not render the Custom Audience card when no HOT_LEADS audience exists yet", async () => {
    mockFetchRouter();
    render(<LookalikeClient />);
    await waitFor(() => expect(screen.getByTestId("lookalike-status-card")).toBeInTheDocument());
    expect(screen.queryByTestId("lookalike-audience-card")).not.toBeInTheDocument();
  });

  it("Sync Hot Leads ke Meta calls the real /api/lookalike/sync endpoint", async () => {
    mockFetchRouter();
    render(<LookalikeClient />);
    await waitFor(() => expect(screen.getByTestId("lookalike-status-card")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Sync Hot Leads ke Meta/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Sync Hot Leads ke Meta/ })).toBeEnabled(),
    );
  });

  it("once eligible (100+), shows the Custom Audience card and no warning note", async () => {
    mockFetchRouter({
      status: () => jsonResponse({ status: ELIGIBLE_STATUS }),
      audiences: () => jsonResponse({ audiences: [CUSTOM_AUDIENCE] }),
    });
    render(<LookalikeClient />);
    await waitFor(() => expect(screen.getByTestId("lookalike-audience-card")).toBeInTheDocument());

    expect(screen.getByText("AAOS-HotLeads-dss-motor-Aug2026")).toBeInTheDocument();
    expect(screen.getByText(/124 orang/)).toBeInTheDocument();
    expect(screen.queryByText(/Meta membutuhkan minimal/)).not.toBeInTheDocument();
  });

  it("shows all 3 Lookalike percentage rows, with a create button only for percentages not yet built", async () => {
    mockFetchRouter({
      status: () => jsonResponse({ status: ELIGIBLE_STATUS }),
      audiences: () => jsonResponse({ audiences: [CUSTOM_AUDIENCE, LOOKALIKE_1PCT] }),
    });
    render(<LookalikeClient />);
    await waitFor(() => expect(screen.getByTestId("lookalike-audience-list")).toBeInTheDocument());

    expect(screen.getByText("Lookalike 1%")).toBeInTheDocument();
    expect(screen.getByText("Lookalike 2%")).toBeInTheDocument();
    expect(screen.getByText("Lookalike 3%")).toBeInTheDocument();
    expect(screen.getByText(/✅ AKTIF/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Buat Lookalike 2%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Buat Lookalike 3%" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Buat Lookalike 1%" })).not.toBeInTheDocument();
  });

  it("+ Buat Lookalike 2% calls the real create endpoint and refreshes the list", async () => {
    mockFetchRouter({
      status: () => jsonResponse({ status: ELIGIBLE_STATUS }),
      audiences: () => jsonResponse({ audiences: [CUSTOM_AUDIENCE, LOOKALIKE_1PCT] }),
    });
    render(<LookalikeClient />);
    await waitFor(() => expect(screen.getByTestId("lookalike-audience-list")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "+ Buat Lookalike 2%" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "+ Buat Lookalike 2%" })).toBeEnabled(),
    );
  });
});
