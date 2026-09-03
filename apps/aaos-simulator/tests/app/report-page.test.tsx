import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReportPage from "@/app/report/page";

/** Renders the real Server Component; `ReportClient` inside it kicks off a real `fetch("/api/simulate-all")` on mount — stubbed here to a never-network-touching mock so the page shell + loading state render deterministically. The full end-to-end run is covered by `tests/api/simulate-all.test.ts` and manual dev-server verification. */
describe("ReportPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the page heading and starts in a loading state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [],
            report: {
              judgedAt: new Date().toISOString(),
              totalPersonas: 0,
              approvedCount: 0,
              needsImprovementCount: 0,
              failCount: 0,
              overallVerdict: "APPROVE",
              avgOverallScore: 0,
              results: [],
              weakestDimensions: [],
              topPriorities: [],
              goldenCandidates: [],
            },
            learningBridge: { status: "SKIPPED", reason: "not configured in this test" },
          }),
      }),
    );

    render(<ReportPage />);
    expect(screen.getByText("📊 Laporan Semua Skenario")).toBeInTheDocument();
    expect(screen.getByText("10 persona, run sekaligus")).toBeInTheDocument();
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();

    // Let the stubbed fetch's pending resolution settle inside `act` before the test ends.
    await waitFor(() => expect(screen.getByTestId("overall-verdict-card")).toBeInTheDocument());
  });
});
