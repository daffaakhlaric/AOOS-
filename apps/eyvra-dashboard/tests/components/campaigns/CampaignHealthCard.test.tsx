import { render, screen, waitFor } from "@testing-library/react";
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

describe("CampaignHealthCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loading state: shows a spinner before the real campaign-health fetch resolves", () => {
    mockFetch({
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
});
