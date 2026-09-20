import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * EYVRA SAMANTHA V2 + KAI V2 Phase 52 (PROMPT 85/86/87/88/89) — `KaiStudioClient`'s own suite.
 * `CampaignHealthCard` (Phase 14/18/19/23's own independently-tested Samantha Brief card) and
 * `CreativePackageCard` (`CreativePackageCard.test.tsx`'s own independently-tested Inspector
 * detail view) are mocked to markers here, same isolation precedent
 * `CampaignsHubClient.test.tsx` already established for these exact same two components — this
 * suite proves KAI STUDIO'S OWN real logic (campaign selection, listing resolution, grid
 * filtering, selection state, the honest stepper), not their internals.
 */
vi.mock("@/components/campaigns/CampaignHealthCard", () => ({
  CampaignHealthCard: (props: {
    readonly campaignId: string;
    readonly campaignName: string;
    readonly listingId?: string;
  }) => (
    <div data-testid="real-campaign-health-card">
      {props.campaignId} name:{props.campaignName} listingId:{props.listingId ?? "none"}
    </div>
  ),
}));
vi.mock("@/components/creative/CreativePackageCard", () => ({
  CreativePackageCard: (props: {
    readonly pkg: { readonly id: string; readonly title: string };
    readonly onApprove: (id: string) => void;
    readonly onReject: () => void;
  }) => (
    <div data-testid="real-creative-package-card">
      {props.pkg.title}
      <button type="button" data-testid="fake-approve" onClick={() => props.onApprove("v-a")}>
        approve
      </button>
      <button type="button" data-testid="fake-reject" onClick={props.onReject}>
        reject
      </button>
    </div>
  ),
}));

import { KaiStudioClient } from "@/components/creative/KaiStudioClient";
import { writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto, CreativePackageDto } from "@/types/dashboard.types";

const SNAPSHOT: AdAccountSummaryDto = {
  id: "act_1",
  name: "Property Main",
  syncedAt: "2026-09-01T00:00:00.000Z",
  campaigns: [
    {
      id: "c1",
      metaId: "meta-c1",
      stableId: "#A001",
      name: "Listing Serpong Selatan",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 500_000,
      dailyBudget: 0,
      adSets: [],
    },
    {
      id: "c2",
      metaId: "meta-c2",
      stableId: "#A002",
      name: "Listing BSD",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 300_000,
      dailyBudget: 0,
      adSets: [],
    },
  ],
  ads: [],
  totals: {
    spend: 800_000,
    clicks: 0,
    frequency: 0,
    conversations: 0,
    d2: 0,
    d3: 0,
    d5: 0,
    leadForm: 0,
    totalLead: 0,
    rphD3: null,
    rphLead: null,
  },
  campaignCount: 2,
  adCount: 0,
};

function seedCache(): void {
  writeCampaignsCache({ data: SNAPSHOT, fetchedAt: Date.now(), period: "last_30d" });
}

const PACKAGE: CreativePackageDto = {
  id: "pkg-1",
  briefId: "brief-1",
  vertical: "PROPERTY",
  listingId: "listing-serpong",
  title: "Rumah Serpong Selatan · DP_RINGAN",
  angle: "DP_RINGAN",
  reason: "Brief manual.",
  requestedFormat: "IMAGES_ONLY",
  primaryMessage: "DP mulai 29 juta",
  urgency: "HIGH",
  aiRecommended: false,
  fatigueStatus: "NORMAL",
  origin: "MANUAL",
  status: "PENDING",
  sourcePhotoUrls: [],
  imageUrls: ["https://gcs/a.jpg"],
  copyVariants: [
    { id: "v-a", variantLabel: "A", primaryText: "Copy A", headline: "H", callToAction: "CTA" },
  ],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetch(options?: {
  readonly listingId?: string | null;
  readonly packages?: readonly CreativePackageDto[];
}): void {
  const listingId = options?.listingId === undefined ? "listing-serpong" : options.listingId;
  const packages = options?.packages ?? [PACKAGE];
  global.fetch = vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes("/listing-id")) {
      return jsonResponse({ listingId });
    }
    if (url.includes("/api/creative") && !url.includes("approve") && !url.includes("reject")) {
      return jsonResponse({ packages });
    }
    if (url.includes("/approve")) {
      return jsonResponse({ package: { ...PACKAGE, status: "APPROVED" } });
    }
    if (url.includes("/reject")) {
      return jsonResponse({ package: { ...PACKAGE, status: "REJECTED" } });
    }
    return jsonResponse({});
  }) as unknown as typeof fetch;
}

describe("KaiStudioClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shows an empty state and no columns before a campaign is selected", async () => {
    seedCache();
    mockFetch();
    render(<KaiStudioClient />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("kai-studio-columns")).not.toBeInTheDocument();
    // The page-wide `/api/creative` fetch runs unconditionally on mount (so the grid is ready the
    // moment a campaign IS picked) — wait for it to settle so this test doesn't leave a dangling
    // unawaited state update for the next test.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  it("lists real campaigns from the shared campaigns snapshot in the picker", async () => {
    seedCache();
    mockFetch();
    render(<KaiStudioClient />);
    expect(screen.getByRole("option", { name: "Listing Serpong Selatan" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Listing BSD" })).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  it("selecting a campaign renders all 3 real columns, resolves listingId, and passes it to CampaignHealthCard", async () => {
    seedCache();
    mockFetch();
    render(<KaiStudioClient />);

    await userEvent.selectOptions(screen.getByTestId("kai-studio-campaign-select"), "c1");

    expect(screen.getByTestId("kai-studio-brief-column")).toBeInTheDocument();
    expect(screen.getByTestId("kai-studio-concepts-column")).toBeInTheDocument();
    expect(screen.getByTestId("kai-studio-inspector-column")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId("real-campaign-health-card")).toHaveTextContent(
        "listingId:listing-serpong",
      ),
    );
  });

  it("renders the real listing-scoped creative packages as concept cards, filtering out other listings", async () => {
    seedCache();
    mockFetch({
      listingId: "listing-serpong",
      packages: [PACKAGE, { ...PACKAGE, id: "pkg-2", listingId: "some-other-listing" }],
    });
    render(<KaiStudioClient />);
    await userEvent.selectOptions(screen.getByTestId("kai-studio-campaign-select"), "c1");

    await waitFor(() => expect(screen.getAllByTestId("kai-studio-concept-card")).toHaveLength(1));
  });

  it("shows an honest empty state in the concepts column when the campaign has no listing mapping", async () => {
    seedCache();
    mockFetch({ listingId: null });
    render(<KaiStudioClient />);
    await userEvent.selectOptions(screen.getByTestId("kai-studio-campaign-select"), "c1");

    await waitFor(() =>
      expect(screen.getByText(/belum terhubung ke listing/i)).toBeInTheDocument(),
    );
  });

  it("selecting a concept card shows the real CreativePackageCard and an honest stepper in the Inspector", async () => {
    seedCache();
    mockFetch();
    render(<KaiStudioClient />);
    await userEvent.selectOptions(screen.getByTestId("kai-studio-campaign-select"), "c1");

    await waitFor(() => expect(screen.getByTestId("kai-studio-concept-card")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("kai-studio-concept-card"));

    expect(screen.getByTestId("real-creative-package-card")).toHaveTextContent(PACKAGE.title);
    expect(screen.getByTestId("kai-studio-stepper")).toBeInTheDocument();
    // PENDING maps to the real "Review" stage — never a fabricated "QA"/"Shortlist"/"Test" label.
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.queryByText(/QA|Shortlist|Test/)).not.toBeInTheDocument();
  });

  it("shows the off-path badge (not a stepper position) for a REJECTED package", async () => {
    seedCache();
    mockFetch({ packages: [{ ...PACKAGE, status: "REJECTED" }] });
    render(<KaiStudioClient />);
    await userEvent.selectOptions(screen.getByTestId("kai-studio-campaign-select"), "c1");

    await waitFor(() => expect(screen.getByTestId("kai-studio-concept-card")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("kai-studio-concept-card"));

    expect(screen.getByTestId("kai-studio-stepper-offpath")).toHaveTextContent("Ditolak");
  });

  it("approving from the Inspector calls the real approve endpoint and re-reads the package list", async () => {
    seedCache();
    mockFetch();
    render(<KaiStudioClient />);
    await userEvent.selectOptions(screen.getByTestId("kai-studio-campaign-select"), "c1");
    await waitFor(() => expect(screen.getByTestId("kai-studio-concept-card")).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("kai-studio-concept-card"));

    await userEvent.click(screen.getByTestId("fake-approve"));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/creative/pkg-1/approve"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
