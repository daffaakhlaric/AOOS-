import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpportunitiesCard } from "@/components/campaigns/OpportunitiesCard";

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

const EMPTY_OPPORTUNITIES = {
  campaignId: "camp-1",
  opportunities: [],
};

const POPULATED_OPPORTUNITIES = {
  campaignId: "camp-1",
  opportunities: [
    {
      type: "SCALING_OPPORTUNITY",
      confidence: 0.82,
      description:
        "Campaign camp-1 menunjukkan sinyal performa positif yang kuat (confidence 82%) — pertimbangkan untuk scaling budget.",
      evidence:
        "Keputusan Samantha untuk campaign ini adalah SCALE dengan confidence 82% (root cause: CTR_IMPROVEMENT). CTR naik signifikan.",
    },
    {
      type: "CREATIVE_WINNER_EXPANSION",
      confidence: 0.65,
      description:
        'Angle "Diskon Akhir Tahun" adalah performer terbaik saat ini (rank 1) — pertimbangkan meminta lebih banyak variasi creative dengan angle ini ke Kai.',
      evidence:
        'Angle "Diskon Akhir Tahun" memiliki CPL Rp45000 dari 4 creative package dengan data sufficiency MEDIUM.',
    },
  ],
};

describe("OpportunitiesCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loading state: shows a spinner before the real opportunities fetch resolves", () => {
    mockFetch({
      "/api/opportunities/camp-1": { body: EMPTY_OPPORTUNITIES },
    });
    render(<OpportunitiesCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    expect(screen.getByTestId("opportunities-card")).toBeInTheDocument();
    expect(screen.queryByTestId("opportunity-row")).not.toBeInTheDocument();
  });

  it("error state: shows an honest error message when the fetch fails", async () => {
    mockFetch({
      "/api/opportunities/camp-1": { body: { error: { message: "boom" } }, status: 500 },
    });
    render(<OpportunitiesCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() =>
      expect(screen.getByText("Gagal memuat Opportunities.")).toBeInTheDocument(),
    );
  });

  it("empty state: renders an honest 'no opportunities' message when the real result is an empty array", async () => {
    mockFetch({
      "/api/opportunities/camp-1": { body: EMPTY_OPPORTUNITIES },
    });
    render(<OpportunitiesCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    expect(
      screen.getByText("Belum ada opportunity nyata terdeteksi untuk campaign ini saat ini."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("opportunity-row")).not.toBeInTheDocument();
  });

  it("populated state: renders both real opportunity types with the correct label/confidence%/description/evidence", async () => {
    mockFetch({
      "/api/opportunities/camp-1": { body: POPULATED_OPPORTUNITIES },
    });
    render(<OpportunitiesCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() => expect(screen.getAllByTestId("opportunity-row")).toHaveLength(2));

    const labels = screen.getAllByTestId("opportunity-type-label");
    expect(labels[0]).toHaveTextContent("Peluang Scaling");
    expect(labels[1]).toHaveTextContent("Angle Creative Terbaik");

    const confidences = screen.getAllByTestId("opportunity-confidence");
    expect(confidences[0]).toHaveTextContent("82%");
    expect(confidences[1]).toHaveTextContent("65%");

    expect(screen.getByText(/menunjukkan sinyal performa positif yang kuat/)).toBeInTheDocument();
    expect(
      screen.getByText(/Keputusan Samantha untuk campaign ini adalah SCALE/),
    ).toBeInTheDocument();

    expect(screen.getByText(/performer terbaik saat ini \(rank 1\)/)).toBeInTheDocument();
    expect(screen.getByText(/memiliki CPL Rp45000/)).toBeInTheDocument();
  });

  it("re-fetches when campaignId changes, resetting to the loading state first", async () => {
    mockFetch({
      "/api/opportunities/camp-1": { body: EMPTY_OPPORTUNITIES },
      "/api/opportunities/camp-2": { body: POPULATED_OPPORTUNITIES },
    });
    const { rerender } = render(
      <OpportunitiesCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />,
    );
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());

    rerender(<OpportunitiesCard campaignId="camp-2" campaignName="Campaign Dua" />);
    await waitFor(() => expect(screen.getAllByTestId("opportunity-row")).toHaveLength(2));
  });
});
