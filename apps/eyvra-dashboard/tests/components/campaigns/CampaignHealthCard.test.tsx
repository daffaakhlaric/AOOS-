import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CampaignHealthCard } from "@/components/campaigns/CampaignHealthCard";

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

const HEALTHY_DIMENSION = { status: "HEALTHY", score: 100, confidence: 1, issues: [] };
const UNKNOWN_DIMENSION = {
  status: "UNKNOWN",
  confidence: 0,
  issues: ["Data audience-saturation belum tersedia di codebase ini."],
};

const POPULATED_RESPONSE = {
  campaignId: "camp-1",
  health: {
    delivery: HEALTHY_DIMENSION,
    costEfficiency: {
      status: "WARNING",
      score: 40,
      confidence: 0.66,
      issues: [
        "CPL saat ini Rp60000 (+60% dibanding benchmark Rp37500) — signifikan lebih mahal dari biasanya.",
      ],
    },
    creative: {
      status: "CRITICAL",
      score: 20,
      confidence: 0.9,
      issues: ["Frequency sudah 5.2 — creative kemungkinan sudah jenuh."],
    },
    audience: UNKNOWN_DIMENSION,
    conversion: HEALTHY_DIMENSION,
    tracking: UNKNOWN_DIMENSION,
    leadQuality: UNKNOWN_DIMENSION,
    overallStatus: "CRITICAL",
  },
  diagnosis: {
    rootCause: "CREATIVE_FATIGUE",
    confidence: 0.9,
    impact: "HIGH",
    evidence: [],
    contributingFactors: [],
    recommendedFocus: ["costEfficiency", "creative"],
  },
  decision: {
    decision: "REQUEST_KAI_CREATIVE",
    primaryDiagnosis: "CREATIVE_FATIGUE",
    confidence: 0.9,
    impact: "HIGH",
    reason:
      "Root cause CREATIVE_FATIGUE terdeteksi (confidence 90%) — creative existing kemungkinan sudah jenuh.",
    riskOfDoingNothing:
      "CTR dan performa creative berpotensi terus menurun selama creative fatigue dibiarkan tanpa aset baru.",
    expectedOutcome: "Creative baru dari Kai berpotensi memulihkan CTR ke level sebelum fatigue.",
    monitoringPlan: {
      reviewAfterHours: 48,
      successConditions: [
        "Dimensi creative kembali ke status HEALTHY setelah creative baru dari Kai tayang.",
      ],
      rollbackConditions: [
        "Creative baru dari Kai tidak memperbaiki dimensi creative dalam periode review — perlu diagnosis ulang.",
      ],
    },
  },
};

const NO_ROOT_CAUSE_RESPONSE = {
  campaignId: "camp-2",
  health: {
    delivery: HEALTHY_DIMENSION,
    costEfficiency: HEALTHY_DIMENSION,
    creative: HEALTHY_DIMENSION,
    audience: UNKNOWN_DIMENSION,
    conversion: HEALTHY_DIMENSION,
    tracking: UNKNOWN_DIMENSION,
    leadQuality: UNKNOWN_DIMENSION,
    overallStatus: "HEALTHY",
  },
  diagnosis: {
    confidence: 0,
    impact: "UNKNOWN",
    evidence: [],
    contributingFactors: [],
    recommendedFocus: [],
  },
  decision: {
    decision: "NO_ACTION",
    confidence: 1,
    impact: "LOW",
    reason: "Semua dimensi campaign health yang punya data nyata berstatus HEALTHY.",
    riskOfDoingNothing: "Tidak ada risiko signifikan.",
    expectedOutcome:
      "Performa campaign berpotensi tetap stabil selama tidak ada perubahan berarti.",
    monitoringPlan: {
      reviewAfterHours: 72,
      successConditions: ["overallStatus tetap HEALTHY pada penilaian berikutnya."],
      rollbackConditions: [],
    },
  },
};

const TREND_UNAVAILABLE_RESPONSE = {
  available: false,
  reason:
    "Baru ada 1 penilaian yang tercatat untuk campaign ini — belum ada pembanding dari penilaian sebelumnya.",
};

// Phase 20 — a real applicable-`Verdict` decision (`PAUSE`) fixture, distinct from
// `POPULATED_RESPONSE`'s `REQUEST_KAI_CREATIVE` and `NO_ROOT_CAUSE_RESPONSE`'s `NO_ACTION` — the
// "Terapkan Verdict Ini" button must render for this one and NOT for the other two.
const PAUSE_DECISION_RESPONSE = {
  campaignId: "camp-3",
  health: {
    delivery: HEALTHY_DIMENSION,
    costEfficiency: {
      status: "CRITICAL",
      score: 10,
      confidence: 0.9,
      issues: ["CPL sangat tinggi"],
    },
    creative: HEALTHY_DIMENSION,
    audience: UNKNOWN_DIMENSION,
    conversion: HEALTHY_DIMENSION,
    tracking: UNKNOWN_DIMENSION,
    leadQuality: UNKNOWN_DIMENSION,
    overallStatus: "CRITICAL",
  },
  diagnosis: {
    rootCause: "SPEND_WITHOUT_RESULT",
    confidence: 0.95,
    impact: "CRITICAL",
    evidence: [],
    contributingFactors: [],
    recommendedFocus: ["costEfficiency"],
  },
  decision: {
    decision: "PAUSE",
    primaryDiagnosis: "SPEND_WITHOUT_RESULT",
    confidence: 0.95,
    impact: "CRITICAL",
    reason:
      "Budget nyata sudah terpakai tanpa lead nyata — sinyal paling jelas untuk menghentikan spend.",
    riskOfDoingNothing: "Budget akan terus terpakai tanpa menghasilkan lead nyata.",
    expectedOutcome: "Menghentikan campaign berpotensi mencegah pemborosan budget lebih lanjut.",
    monitoringPlan: {
      reviewAfterHours: 24,
      successConditions: ["Campaign berhenti membelanjakan budget tanpa lead nyata."],
      rollbackConditions: [],
    },
  },
};

const TREND_AVAILABLE_RESPONSE = {
  available: true,
  comparison: {
    dimensionTrends: {
      delivery: "UNCHANGED",
      costEfficiency: "WORSENED",
      creative: "IMPROVED",
      audience: "NEWLY_KNOWN",
      conversion: "UNCHANGED",
      tracking: "NEWLY_UNKNOWN",
      leadQuality: "UNCHANGED",
    },
    overallStatusTrend: "WORSENED",
    rootCauseTrend: "NEW",
    decisionChanged: true,
    summary:
      "Root cause baru terdeteksi: CREATIVE_FATIGUE — sebelumnya belum ada root cause yang jelas.",
  },
  previousAssessedAt: "2026-09-10T00:00:00.000Z",
  currentAssessedAt: "2026-09-17T00:00:00.000Z",
};

describe("CampaignHealthCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loading state: shows a spinner before the real campaign-health fetch resolves", () => {
    mockFetch({
      "/api/campaign-health/camp-1/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-1": { body: NO_ROOT_CAUSE_RESPONSE },
    });
    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    expect(screen.getByTestId("campaign-health-card")).toBeInTheDocument();
    expect(screen.queryByTestId("overall-status-badge")).not.toBeInTheDocument();
  });

  it("error state: shows an honest error message when the fetch fails", async () => {
    mockFetch({
      "/api/campaign-health/camp-1": { body: { error: { message: "boom" } }, status: 500 },
    });
    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() =>
      expect(screen.getByText("Gagal memuat Campaign Health.")).toBeInTheDocument(),
    );
  });

  it("error state: degrades honestly when the response body is malformed (missing health/diagnosis/decision)", async () => {
    mockFetch({
      "/api/campaign-health/camp-1": { body: { campaignId: "camp-1" } },
    });
    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() =>
      expect(screen.getByText("Respons Campaign Health tidak lengkap.")).toBeInTheDocument(),
    );
  });

  it("populated state: renders the overall status badge, dimension rows, diagnosis and decision content", async () => {
    mockFetch({
      "/api/campaign-health/camp-1/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-1": { body: POPULATED_RESPONSE },
    });
    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);

    await waitFor(() => expect(screen.getByTestId("overall-status-badge")).toBeInTheDocument());
    expect(screen.getByTestId("overall-status-badge")).toHaveTextContent("Kritis");

    const dimensionRows = screen.getAllByTestId("health-dimension-row");
    expect(dimensionRows).toHaveLength(7);
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Efisiensi Biaya")).toBeInTheDocument();
    expect(screen.getByText("Creative")).toBeInTheDocument();
    expect(
      screen.getByText(/CPL saat ini Rp60000 \(\+60% dibanding benchmark Rp37500\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Frequency sudah 5\.2 — creative kemungkinan sudah jenuh\./),
    ).toBeInTheDocument();

    const diagnosisBox = screen.getByTestId("diagnosis-summary");
    expect(diagnosisBox).toHaveTextContent("CREATIVE_FATIGUE");
    expect(diagnosisBox).toHaveTextContent("90%");
    expect(diagnosisBox).toHaveTextContent("HIGH");

    const decisionBox = screen.getByTestId("decision-summary");
    expect(decisionBox).toHaveTextContent("Minta Creative Baru ke Kai");
    expect(decisionBox).toHaveTextContent(
      "Root cause CREATIVE_FATIGUE terdeteksi (confidence 90%) — creative existing kemungkinan sudah jenuh.",
    );
  });

  it("honest rootCause fallback: shows 'Tidak ada root cause terdeteksi' when diagnosis.rootCause is undefined, never blank", async () => {
    mockFetch({
      "/api/campaign-health/camp-2": { body: NO_ROOT_CAUSE_RESPONSE },
    });
    render(<CampaignHealthCard campaignId="camp-2" campaignName="Cluster Anggrek Campaign" />);

    await waitFor(() => expect(screen.getByTestId("overall-status-badge")).toBeInTheDocument());
    expect(screen.getByTestId("overall-status-badge")).toHaveTextContent("Sehat");
    expect(screen.getByTestId("diagnosis-summary")).toHaveTextContent(
      "Tidak ada root cause terdeteksi",
    );
    expect(screen.getByTestId("decision-summary")).toHaveTextContent("Tidak Ada Tindakan");
  });

  it("re-fetches when campaignId changes, resetting to the loading state first", async () => {
    mockFetch({
      "/api/campaign-health/camp-1": { body: NO_ROOT_CAUSE_RESPONSE },
      "/api/campaign-health/camp-2": { body: POPULATED_RESPONSE },
    });
    const { rerender } = render(
      <CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("overall-status-badge")).toHaveTextContent("Sehat"),
    );

    rerender(<CampaignHealthCard campaignId="camp-2" campaignName="Campaign Dua" />);
    await waitFor(() =>
      expect(screen.getByTestId("overall-status-badge")).toHaveTextContent("Kritis"),
    );
  });

  it("trend section: shows the real honest reason when compare-latest returns available: false", async () => {
    mockFetch({
      "/api/campaign-health/camp-1/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-1": { body: POPULATED_RESPONSE },
    });
    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);

    await waitFor(() => expect(screen.getByTestId("assessment-trend-section")).toBeInTheDocument());
    expect(screen.getByTestId("trend-unavailable-reason")).toHaveTextContent(
      "Baru ada 1 penilaian yang tercatat untuk campaign ini",
    );
    expect(screen.queryByTestId("trend-summary")).not.toBeInTheDocument();
  });

  it("trend section: renders summary, dimension trend badges, overallStatusTrend, rootCauseTrend and decisionChanged when compare-latest returns available: true", async () => {
    mockFetch({
      "/api/campaign-health/camp-1/compare-latest": { body: TREND_AVAILABLE_RESPONSE },
      "/api/campaign-health/camp-1": { body: POPULATED_RESPONSE },
    });
    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);

    await waitFor(() => expect(screen.getByTestId("trend-summary")).toBeInTheDocument());
    expect(screen.getByTestId("trend-summary")).toHaveTextContent(
      "Root cause baru terdeteksi: CREATIVE_FATIGUE",
    );

    const dimensionTrendBadges = screen.getAllByTestId("dimension-trend-badge");
    expect(dimensionTrendBadges.length).toBeGreaterThanOrEqual(3);
    expect(dimensionTrendBadges.some((badge) => badge.textContent?.includes("Memburuk"))).toBe(
      true,
    );
    expect(dimensionTrendBadges.some((badge) => badge.textContent?.includes("Membaik"))).toBe(true);
    expect(
      dimensionTrendBadges.some((badge) => badge.textContent?.includes("Baru Diketahui")),
    ).toBe(true);

    expect(screen.getByTestId("trend-overall-status")).toHaveTextContent("Memburuk");
    expect(screen.getByTestId("trend-root-cause")).toHaveTextContent("Root Cause Baru");
    expect(screen.getByTestId("trend-decision-changed")).toHaveTextContent("Rekomendasi berubah");
  });

  it("trend section: honest absence (renders nothing) when the compare-latest fetch fails entirely, never crashing the card", async () => {
    mockFetch({
      "/api/campaign-health/camp-1": { body: POPULATED_RESPONSE },
    });
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("compare-latest")) {
        throw new Error("network down");
      }
      if (url === "/api/campaign-health/camp-1") {
        return new Response(JSON.stringify(POPULATED_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as unknown as typeof fetch;

    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);

    await waitFor(() => expect(screen.getByTestId("overall-status-badge")).toBeInTheDocument());
    expect(screen.getByTestId("campaign-health-card")).toBeInTheDocument();
    expect(screen.queryByTestId("assessment-trend-section")).not.toBeInTheDocument();
  });

  it("assess button: records a new assessment, updates the card and re-fetches the trend on success", async () => {
    const routes: Record<string, { body: unknown; status?: number }> = {
      "/api/campaign-health/camp-1/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-1/assess": { body: POPULATED_RESPONSE },
      "/api/campaign-health/camp-1": { body: NO_ROOT_CAUSE_RESPONSE },
    };
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/assess") && init?.method === "POST") {
        routes["/api/campaign-health/camp-1/compare-latest"] = { body: TREND_AVAILABLE_RESPONSE };
        return new Response(JSON.stringify(POPULATED_RESPONSE), { status: 200 });
      }
      const matchKey = Object.keys(routes).find((key) => url === key || url.startsWith(key));
      const route = matchKey !== undefined ? routes[matchKey] : undefined;
      if (route === undefined) {
        return new Response(JSON.stringify({}), { status: 404 });
      }
      return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
    }) as unknown as typeof fetch;

    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() =>
      expect(screen.getByTestId("overall-status-badge")).toHaveTextContent("Sehat"),
    );

    const button = screen.getByTestId("assess-button");
    expect(button).toHaveTextContent("Rekam Assessment Ini");
    button.click();

    await waitFor(() => expect(button).toHaveTextContent("Merekam..."));
    await waitFor(() =>
      expect(screen.getByTestId("overall-status-badge")).toHaveTextContent("Kritis"),
    );
    await waitFor(() => expect(screen.getByTestId("trend-summary")).toBeInTheDocument());
    expect(screen.queryByTestId("assess-error")).not.toBeInTheDocument();
  });

  it("assess button: shows an honest error when the assess POST fails, without crashing the card", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/assess") && init?.method === "POST") {
        return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
      }
      if (url.includes("compare-latest")) {
        return new Response(JSON.stringify(TREND_UNAVAILABLE_RESPONSE), { status: 200 });
      }
      if (url === "/api/campaign-health/camp-1") {
        return new Response(JSON.stringify(NO_ROOT_CAUSE_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as unknown as typeof fetch;

    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() =>
      expect(screen.getByTestId("overall-status-badge")).toHaveTextContent("Sehat"),
    );

    screen.getByTestId("assess-button").click();

    await waitFor(() => expect(screen.getByTestId("assess-error")).toBeInTheDocument());
    expect(screen.getByTestId("assess-error")).toHaveTextContent("Gagal merekam assessment.");
    expect(screen.getByTestId("campaign-health-card")).toBeInTheDocument();
  });

  // Phase 19 — real "Brief Kai Sekarang" action in the decision section, triggered honestly only
  // by Samantha's own real `REQUEST_KAI_CREATIVE` decision. Mirrors `AndromedaHealthCard.tsx`'s
  // own `handleBriefKai` exactly (same endpoint/body shape), reused with a different trigger.
  it("Brief Kai button: renders only when decision.decision is REQUEST_KAI_CREATIVE", async () => {
    mockFetch({
      "/api/campaign-health/camp-1/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-1": { body: POPULATED_RESPONSE },
    });
    render(
      <CampaignHealthCard
        campaignId="camp-1"
        campaignName="Cluster Anggrek Campaign"
        listingId="listing-1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("decision-brief-kai-button")).toBeInTheDocument(),
    );
  });

  it("Brief Kai button: does NOT render when decision.decision is a different value (e.g. NO_ACTION)", async () => {
    mockFetch({
      "/api/campaign-health/camp-2/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-2": { body: NO_ROOT_CAUSE_RESPONSE },
    });
    render(
      <CampaignHealthCard
        campaignId="camp-2"
        campaignName="Cluster Anggrek Campaign"
        listingId="listing-1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("decision-summary")).toHaveTextContent("Tidak Ada Tindakan"),
    );
    expect(screen.queryByTestId("decision-brief-kai-button")).not.toBeInTheDocument();
  });

  it("Brief Kai button: disabled with an honest explanation when no listingId can be resolved", async () => {
    mockFetch({
      "/api/campaign-health/camp-1/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-1": { body: POPULATED_RESPONSE },
    });
    render(<CampaignHealthCard campaignId="camp-1" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() => expect(screen.getByTestId("decision-brief-kai-button")).toBeDisabled());
    expect(
      screen.getByText(
        "Tidak bisa menentukan listing untuk campaign ini secara otomatis — buat brief manual di halaman Listing.",
      ),
    ).toBeInTheDocument();
  });

  it("Brief Kai button: successful brief-creation flow calls the real diverse-set endpoint and renders the real result", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/creative-packages/diverse-set" && init?.method === "POST") {
        expect(init.body).toBe(
          JSON.stringify({ listingId: "listing-1", campaignId: "camp-1", requestedCount: 5 }),
        );
        return new Response(
          JSON.stringify({
            requestedCount: 5,
            allowedCount: 5,
            cappedByDailyLimit: false,
            createdCount: 3,
            packages: [],
          }),
          { status: 200 },
        );
      }
      if (url.includes("compare-latest")) {
        return new Response(JSON.stringify(TREND_UNAVAILABLE_RESPONSE), { status: 200 });
      }
      if (url === "/api/campaign-health/camp-1") {
        return new Response(JSON.stringify(POPULATED_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as unknown as typeof fetch;

    render(
      <CampaignHealthCard
        campaignId="camp-1"
        campaignName="Cluster Anggrek Campaign"
        listingId="listing-1"
      />,
    );
    await waitFor(() => expect(screen.getByTestId("decision-brief-kai-button")).not.toBeDisabled());

    fireEvent.click(screen.getByTestId("decision-brief-kai-button"));

    await waitFor(() => expect(screen.getByTestId("decision-brief-result")).toBeInTheDocument());
    expect(screen.getByTestId("decision-brief-result")).toHaveTextContent(
      "3 brief kreatif baru dibuat dan masuk ke antrian review Creative Packages.",
    );
    expect(screen.queryByTestId("decision-brief-error")).not.toBeInTheDocument();
  });

  it("Brief Kai button: shows an honest error when the diverse-set POST fails", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/creative-packages/diverse-set" && init?.method === "POST") {
        return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
      }
      if (url.includes("compare-latest")) {
        return new Response(JSON.stringify(TREND_UNAVAILABLE_RESPONSE), { status: 200 });
      }
      if (url === "/api/campaign-health/camp-1") {
        return new Response(JSON.stringify(POPULATED_RESPONSE), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as unknown as typeof fetch;

    render(
      <CampaignHealthCard
        campaignId="camp-1"
        campaignName="Cluster Anggrek Campaign"
        listingId="listing-1"
      />,
    );
    await waitFor(() => expect(screen.getByTestId("decision-brief-kai-button")).not.toBeDisabled());

    fireEvent.click(screen.getByTestId("decision-brief-kai-button"));

    await waitFor(() => expect(screen.getByTestId("decision-brief-error")).toBeInTheDocument());
    expect(screen.getByTestId("decision-brief-error")).toHaveTextContent("boom");
    expect(screen.queryByTestId("decision-brief-result")).not.toBeInTheDocument();
  });

  // Phase 20 — real "Terapkan Verdict Ini" action, gated on `decision.decision` being one of the
  // 6 real `Verdict` values (`PAUSE`/`SCALE`/`FIX`/`REFRESH`/`KEEP`/`REVIEW`), reusing the SAME
  // real `POST /api/verdicts` mechanism `VerdictCards`'/`CampaignsHubClient`'s own `handleApplyVerdict`
  // already triggers — verified end-to-end (including which id variant reaches `targetId`) in
  // `CampaignsHubClient.test.tsx`'s own dedicated test; this file only verifies the button's own
  // render-gating and that it correctly invokes its `onApplyVerdict` callback.
  it("Apply Verdict button: renders only when decision.decision is a real applicable Verdict (PAUSE)", async () => {
    mockFetch({
      "/api/campaign-health/camp-3/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-3": { body: PAUSE_DECISION_RESPONSE },
    });
    const onApplyVerdict = vi.fn();
    render(
      <CampaignHealthCard
        campaignId="camp-3"
        campaignName="Cluster Anggrek Campaign"
        onApplyVerdict={onApplyVerdict}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("decision-apply-verdict-button")).toBeInTheDocument(),
    );
  });

  it("Apply Verdict button: does NOT render for a REQUEST_KAI_CREATIVE decision", async () => {
    mockFetch({
      "/api/campaign-health/camp-1/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-1": { body: POPULATED_RESPONSE },
    });
    render(
      <CampaignHealthCard
        campaignId="camp-1"
        campaignName="Cluster Anggrek Campaign"
        listingId="listing-1"
        onApplyVerdict={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("decision-brief-kai-button")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("decision-apply-verdict-button")).not.toBeInTheDocument();
  });

  it("Apply Verdict button: does NOT render for a NO_ACTION decision", async () => {
    mockFetch({
      "/api/campaign-health/camp-2/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-2": { body: NO_ROOT_CAUSE_RESPONSE },
    });
    render(
      <CampaignHealthCard
        campaignId="camp-2"
        campaignName="Cluster Anggrek Campaign"
        onApplyVerdict={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("decision-summary")).toHaveTextContent("Tidak Ada Tindakan"),
    );
    expect(screen.queryByTestId("decision-apply-verdict-button")).not.toBeInTheDocument();
  });

  it("Apply Verdict button: does NOT render when onApplyVerdict is not provided, even for an applicable verdict", async () => {
    mockFetch({
      "/api/campaign-health/camp-3/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-3": { body: PAUSE_DECISION_RESPONSE },
    });
    render(<CampaignHealthCard campaignId="camp-3" campaignName="Cluster Anggrek Campaign" />);
    await waitFor(() => expect(screen.getByTestId("decision-summary")).toBeInTheDocument());
    expect(screen.queryByTestId("decision-apply-verdict-button")).not.toBeInTheDocument();
  });

  it("Apply Verdict button: clicking it calls onApplyVerdict with the exact real verdict string and shows an honest acknowledgment", async () => {
    mockFetch({
      "/api/campaign-health/camp-3/compare-latest": { body: TREND_UNAVAILABLE_RESPONSE },
      "/api/campaign-health/camp-3": { body: PAUSE_DECISION_RESPONSE },
    });
    const onApplyVerdict = vi.fn();
    render(
      <CampaignHealthCard
        campaignId="camp-3"
        campaignName="Cluster Anggrek Campaign"
        onApplyVerdict={onApplyVerdict}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("decision-apply-verdict-button")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId("decision-apply-verdict-button"));

    expect(onApplyVerdict).toHaveBeenCalledWith("PAUSE");
    await waitFor(() =>
      expect(screen.getByTestId("decision-apply-verdict-ack")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("decision-apply-verdict-button")).toBeDisabled();
  });
});
