import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReportPage from "@/app/report/page";

/**
 * Renders the real Server Component; `ReportClient` inside it now requires a real tenant selection
 * (this task — `TenantVerticalSelector` fires `GET /api/tenants` on mount) before "Jalankan Semua
 * Skenario" is enabled and `POST /api/simulate-all` is ever called. The full end-to-end run is
 * covered by `tests/api/simulate-all.test.ts` and manual dev-server verification.
 */
describe("ReportPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the page heading and the tenant selector, and does not call /api/simulate-all until Run is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/tenants") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                tenants: [{ tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE" }],
              }),
          });
        }
        return Promise.resolve({
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
              promptOverride: { applied: false, tenantId: "dss-motor" },
            }),
        });
      }),
    );

    render(<ReportPage />);
    expect(screen.getByText("📊 Laporan Semua Skenario")).toBeInTheDocument();
    expect(screen.getByText("10 persona, run sekaligus")).toBeInTheDocument();
    expect(screen.getByTestId("run-all-button")).toBeDisabled();

    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByTestId("run-all-button")).not.toBeDisabled());
    await user.click(screen.getByTestId("run-all-button"));

    await waitFor(() => expect(screen.getByTestId("overall-verdict-card")).toBeInTheDocument());
  });
});
