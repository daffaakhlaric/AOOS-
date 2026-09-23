import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SamanthaDecisionCard } from "@/components/command-center/SamanthaDecisionCard";
import type { CampaignHealthSummaryEntryDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

const unknownDimension = { status: "UNKNOWN", confidence: 0, issues: [] } as const;

/** Real `CampaignHealthSummaryEntryDto` shape (`GET /api/campaign-health/account-summary`'s own per-campaign entry). */
const entry: CampaignHealthSummaryEntryDto = {
  campaignId: "meta-c1",
  campaignName: "Rumah Cluster Bintaro",
  spend: 1_500_000,
  health: {
    delivery: unknownDimension,
    costEfficiency: unknownDimension,
    creative: {
      status: "CRITICAL",
      score: 20,
      confidence: 0.73,
      issues: ["CTR turun 50% dibanding baseline."],
    },
    audience: unknownDimension,
    conversion: unknownDimension,
    tracking: unknownDimension,
    leadQuality: unknownDimension,
    overallStatus: "CRITICAL",
  },
  diagnosis: {
    rootCause: "CREATIVE_FATIGUE",
    confidence: 0.73,
    impact: "HIGH",
    evidence: [],
    contributingFactors: [],
    recommendedFocus: ["creative"],
  },
  decision: {
    decision: "REQUEST_KAI_CREATIVE",
    primaryDiagnosis: "CREATIVE_FATIGUE",
    confidence: 0.73,
    impact: "HIGH",
    reason: "Root cause CREATIVE_FATIGUE terdeteksi.",
    riskOfDoingNothing: "CTR berpotensi terus menurun.",
    expectedOutcome: "Creative baru berpotensi memulihkan CTR.",
    monitoringPlan: { reviewAfterHours: 48, successConditions: [], rollbackConditions: [] },
  },
};

/**
 * Routes the 2 real hops of the campaign -> listing -> photo chain:
 *   `GET /api/campaigns/:id/listing-id`  and  `GET /api/listings/:id`.
 * Anything else fails, exactly as an unmocked endpoint would.
 */
function mockChain(listingIdBody: () => Response, listingBody: () => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/listing-id")) return Promise.resolve(listingIdBody());
      if (url.startsWith("/api/listings/")) return Promise.resolve(listingBody());
      return Promise.resolve(jsonResponse({}, false));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Samantha Attention Queue row thumbnail (real campaign -> listing -> photo chain)", () => {
  it("renders the REAL listing photo once both real hops resolve one", async () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: "listing-9" }),
      () =>
        jsonResponse({
          id: "listing-9",
          title: "Rumah Cluster Bintaro",
          photos: [{ id: "p1", url: "https://gcs.example/real-photo.jpg", order: 0, isMain: true }],
          mainPhotoUrl: "https://gcs.example/real-photo.jpg",
        }),
    );

    render(
      <ul>
        <SamanthaDecisionCard entry={entry} />
      </ul>,
    );

    // The row itself renders immediately — the thumbnail lookup never blocks it.
    expect(screen.getByTestId("decision-card-meta-c1")).toBeInTheDocument();
    expect(screen.getByTestId("decision-thumbnail-placeholder-meta-c1")).toBeInTheDocument();

    const image = await screen.findByTestId("decision-thumbnail-meta-c1");
    // Exactly the real `mainPhotoUrl` the real listing endpoint returned — never a stock/placeholder
    // service URL.
    expect(image).toHaveAttribute("src", "https://gcs.example/real-photo.jpg");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.queryByTestId("decision-thumbnail-placeholder-meta-c1")).not.toBeInTheDocument();
  });

  it("keeps the honest placeholder when the campaign genuinely has no linked listing", async () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: null }),
      () => jsonResponse({}, false),
    );

    render(
      <ul>
        <SamanthaDecisionCard entry={entry} />
      </ul>,
    );

    await waitFor(() => expect(screen.getByTestId("decision-card-meta-c1")).toBeInTheDocument());
    expect(screen.getByTestId("decision-thumbnail-placeholder-meta-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("decision-thumbnail-meta-c1")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps the honest placeholder when the real listing genuinely has no photos", async () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: "listing-9" }),
      () => jsonResponse({ id: "listing-9", title: "Rumah Cluster Bintaro", photos: [] }),
    );

    render(
      <ul>
        <SamanthaDecisionCard entry={entry} />
      </ul>,
    );

    await waitFor(() => expect(screen.getByTestId("decision-card-meta-c1")).toBeInTheDocument());
    expect(screen.getByTestId("decision-thumbnail-placeholder-meta-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("decision-thumbnail-meta-c1")).not.toBeInTheDocument();
  });

  it("never breaks or blanks the row when either real lookup fails", async () => {
    mockChain(
      () => jsonResponse({ error: { message: "Campaign mapping unavailable" } }, false),
      () => jsonResponse({}, false),
    );

    render(
      <ul>
        <SamanthaDecisionCard entry={entry} />
      </ul>,
    );

    await waitFor(() => expect(screen.getByTestId("decision-card-meta-c1")).toBeInTheDocument());
    // The row's real content is intact, and the honest placeholder stays.
    expect(screen.getByText("Rumah Cluster Bintaro")).toBeInTheDocument();
    expect(screen.getByTestId("decision-confidence-meta-c1")).toHaveTextContent("73%");
    expect(screen.getByTestId("decision-thumbnail-placeholder-meta-c1")).toBeInTheDocument();
  });
});

/**
 * Real Meta creative thumbnails (priorities 1-4) — `entry.representativeCreative`, already resolved
 * server-side by `GET /api/v1/command-center/account-summary`. These rows perform NO extra fetch
 * for the Meta thumbnail; the listing chain below it stays as priority 5.
 */
describe("Samantha Attention Queue row thumbnail (real Meta creative, priority 1-4)", () => {
  const withCreative = (
    representativeCreative: NonNullable<CampaignHealthSummaryEntryDto["representativeCreative"]>,
  ): CampaignHealthSummaryEntryDto => ({ ...entry, representativeCreative });

  it("prefers the REAL Meta creative thumbnail over the listing photo", async () => {
    // The listing chain WOULD resolve a photo — the Meta creative must still win.
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: "listing-9" }),
      () =>
        jsonResponse({
          id: "listing-9",
          title: "Rumah Cluster Bintaro",
          mainPhotoUrl: "https://gcs.example/listing-photo.jpg",
        }),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "IMAGE",
            metaAdId: "120000000000001",
            metaCreativeRef: "4b899eb644b9f4649abeea3fe701715c",
            priorityTier: 2,
            thumbnailUrl: "https://scontent.xx.fbcdn.net/v/real-creative.jpg",
          })}
        />
      </ul>,
    );

    const image = screen.getByTestId("decision-thumbnail-meta-c1");
    expect(image).toHaveAttribute("src", "https://scontent.xx.fbcdn.net/v/real-creative.jpg");
    expect(image).toHaveAttribute("data-source", "META_CREATIVE");
    expect(image).toHaveAttribute("loading", "lazy");
    // Even after the listing chain settles, the Meta creative stays.
    await waitFor(() =>
      expect(screen.getByTestId("decision-thumbnail-meta-c1")).toHaveAttribute(
        "src",
        "https://scontent.xx.fbcdn.net/v/real-creative.jpg",
      ),
    );
  });

  it("renders a real VIDEO creative's poster frame, never a video element", () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: null }),
      () => jsonResponse({}, false),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "VIDEO",
            metaAdId: "120000000000002",
            metaCreativeRef: "1523323098869727",
            priorityTier: 1,
            thumbnailUrl: "https://scontent.xx.fbcdn.net/v/poster-frame.jpg",
          })}
        />
      </ul>,
    );

    const image = screen.getByTestId("decision-thumbnail-meta-c1");
    expect(image).toHaveAttribute("src", "https://scontent.xx.fbcdn.net/v/poster-frame.jpg");
    expect(image.tagName).toBe("IMG");
    expect(document.querySelector("video")).toBeNull();
  });

  it("renders the real WINNER badge over the thumbnail", () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: null }),
      () => jsonResponse({}, false),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "IMAGE",
            metaAdId: "120000000000003",
            metaCreativeRef: "hash-winner",
            priorityTier: 1,
            badge: "WINNER",
            thumbnailUrl: "https://scontent.xx.fbcdn.net/v/winner.jpg",
          })}
        />
      </ul>,
    );

    expect(screen.getByTestId("decision-creative-badge-meta-c1")).toHaveTextContent("WINNER");
  });

  it("renders the real FATIGUED badge over the thumbnail", () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: null }),
      () => jsonResponse({}, false),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "IMAGE",
            metaAdId: "120000000000004",
            metaCreativeRef: "hash-tired",
            priorityTier: 2,
            badge: "FATIGUED",
            thumbnailUrl: "https://scontent.xx.fbcdn.net/v/tired.jpg",
          })}
        />
      </ul>,
    );

    expect(screen.getByTestId("decision-creative-badge-meta-c1")).toHaveTextContent("FATIGUED");
  });

  it("renders NO badge when the backend established no real creative condition", () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: null }),
      () => jsonResponse({}, false),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "IMAGE",
            metaAdId: "120000000000005",
            metaCreativeRef: "hash-plain",
            priorityTier: 3,
            thumbnailUrl: "https://scontent.xx.fbcdn.net/v/plain.jpg",
          })}
        />
      </ul>,
    );

    expect(screen.queryByTestId("decision-creative-badge-meta-c1")).not.toBeInTheDocument();
  });

  it("falls back to the real LISTING photo when the creative resolved no thumbnailUrl", async () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: "listing-9" }),
      () =>
        jsonResponse({
          id: "listing-9",
          title: "Rumah Cluster Bintaro",
          mainPhotoUrl: "https://gcs.example/listing-photo.jpg",
        }),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "VIDEO",
            metaAdId: "120000000000006",
            metaCreativeRef: "1777935213340727",
            priorityTier: 4,
            // No `thumbnailUrl` — Meta genuinely did not resolve this ref this pass.
          })}
        />
      </ul>,
    );

    const image = await screen.findByTestId("decision-thumbnail-meta-c1");
    expect(image).toHaveAttribute("src", "https://gcs.example/listing-photo.jpg");
    expect(image).toHaveAttribute("data-source", "LISTING");
  });

  it("falls back to the honest placeholder when neither the Meta creative nor the listing yields a photo", async () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: null }),
      () => jsonResponse({}, false),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "IMAGE",
            metaAdId: "120000000000007",
            metaCreativeRef: "hash-unresolved",
            priorityTier: 4,
          })}
        />
      </ul>,
    );

    await waitFor(() => expect(screen.getByTestId("decision-card-meta-c1")).toBeInTheDocument());
    expect(screen.getByTestId("decision-thumbnail-placeholder-meta-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("decision-thumbnail-meta-c1")).not.toBeInTheDocument();
  });

  it("degrades to the listing photo when a real Meta URL fails to load in the browser (expired CDN url)", async () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: "listing-9" }),
      () =>
        jsonResponse({
          id: "listing-9",
          title: "Rumah Cluster Bintaro",
          mainPhotoUrl: "https://gcs.example/listing-photo.jpg",
        }),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "IMAGE",
            metaAdId: "120000000000008",
            metaCreativeRef: "hash-expired",
            priorityTier: 2,
            thumbnailUrl: "https://scontent.xx.fbcdn.net/v/expired.jpg",
          })}
        />
      </ul>,
    );

    const metaImage = screen.getByTestId("decision-thumbnail-meta-c1");
    expect(metaImage).toHaveAttribute("data-source", "META_CREATIVE");
    fireEvent.error(metaImage);

    await waitFor(() =>
      expect(screen.getByTestId("decision-thumbnail-meta-c1")).toHaveAttribute(
        "data-source",
        "LISTING",
      ),
    );
    expect(screen.getByTestId("decision-thumbnail-meta-c1")).toHaveAttribute(
      "src",
      "https://gcs.example/listing-photo.jpg",
    );
  });

  it("never breaks the row's real content when a Meta thumbnail is present", () => {
    mockChain(
      () => jsonResponse({ campaignId: "meta-c1", listingId: null }),
      () => jsonResponse({}, false),
    );

    render(
      <ul>
        <SamanthaDecisionCard
          entry={withCreative({
            kind: "IMAGE",
            metaAdId: "120000000000009",
            metaCreativeRef: "hash-ok",
            priorityTier: 2,
            badge: "WINNER",
            thumbnailUrl: "https://scontent.xx.fbcdn.net/v/ok.jpg",
            kaiCreativePackageId: "pkg-42",
            assetUrl: "https://storage.googleapis.com/aaos/kai.jpg",
          })}
        />
      </ul>,
    );

    expect(screen.getByText("Rumah Cluster Bintaro")).toBeInTheDocument();
    expect(screen.getByTestId("decision-confidence-meta-c1")).toHaveTextContent("73%");
  });
});
