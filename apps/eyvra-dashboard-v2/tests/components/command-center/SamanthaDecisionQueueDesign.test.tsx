import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SamanthaDecisionCard } from "@/components/command-center/SamanthaDecisionCard";
import { SamanthaDecisionQueue } from "@/components/command-center/SamanthaDecisionQueue";
import type { CampaignHealthSummaryEntryDto, SamanthaSignalDto } from "@/types/dashboard.types";

const unknownDimension = { status: "UNKNOWN", confidence: 0, issues: [] } as const;

/** Real `CampaignHealthSummaryEntryDto` shape — the per-campaign entry of the real `account-summary`. */
function makeEntry(
  overrides: Partial<CampaignHealthSummaryEntryDto> = {},
): CampaignHealthSummaryEntryDto {
  return {
    campaignId: "meta-c1",
    campaignName: "Rumah Cluster Bintaro",
    spend: 1_500_000,
    health: {
      delivery: unknownDimension,
      costEfficiency: unknownDimension,
      creative: { status: "CRITICAL", score: 20, confidence: 0.73, issues: [] },
      audience: unknownDimension,
      conversion: unknownDimension,
      tracking: unknownDimension,
      leadQuality: unknownDimension,
      overallStatus: "CRITICAL",
    },
    diagnosis: {
      rootCause: "CTR_DROP",
      confidence: 0.91,
      impact: "CRITICAL",
      evidence: [],
      contributingFactors: [],
      recommendedFocus: ["creative"],
    },
    decision: {
      decision: "REQUEST_KAI_CREATIVE",
      primaryDiagnosis: "CTR_DROP",
      confidence: 0.91,
      impact: "CRITICAL",
      reason: "Root cause CTR_DROP terdeteksi.",
      riskOfDoingNothing: "CTR berpotensi terus menurun.",
      expectedOutcome: "Creative baru berpotensi memulihkan CTR.",
      monitoringPlan: { reviewAfterHours: 48, successConditions: [], rollbackConditions: [] },
    },
    ...overrides,
  };
}

function evidence(overrides: Partial<SamanthaSignalDto> = {}): SamanthaSignalDto {
  return {
    type: "CTR_DROP",
    severity: "MEDIUM",
    metric: "ctr",
    currentValue: 0.0091,
    baselineValue: 0.0182,
    deltaPct: -0.5,
    confidence: 0.73,
    reasoning: "CTR turun 50% dibanding periode sebelumnya.",
    ...overrides,
  };
}

beforeEach(() => {
  // The row's own listing-photo chain is irrelevant to these assertions — a genuinely failing
  // lookup keeps the honest placeholder and never blocks the row, exactly as in production.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderCard(entry: CampaignHealthSummaryEntryDto): void {
  render(
    <ul>
      <SamanthaDecisionCard entry={entry} />
    </ul>,
  );
}

/**
 * The one real new data wiring: the per-row mini sparkline, fed ONLY by the real
 * `entry.trend` series the cached `account-summary` computes from `meta_insights_daily`.
 */
describe("Samantha Attention Queue row sparkline (real entry.trend series)", () => {
  it("renders from a real trend series, tagged with the real metric and real point count", () => {
    renderCard(makeEntry({ trend: { metric: "ctr", points: [0.0182, 0.0151, 0.0132, 0.0091] } }));

    const spark = screen.getByTestId("decision-sparkline-meta-c1");
    expect(spark).toHaveAttribute("data-metric", "ctr");
    expect(spark).toHaveAttribute("data-points", "4");
    // The real inline SVG path is actually drawn.
    expect(spark.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByLabelText("Tren CTR harian untuk Rumah Cluster Bintaro"),
    ).toBeInTheDocument();
  });

  it("renders NOTHING — no line, no placeholder — when the campaign genuinely has no trend series", () => {
    renderCard(makeEntry());

    expect(screen.queryByTestId("decision-sparkline-meta-c1")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("decision-card-meta-c1").querySelector("svg path[stroke]"),
    ).not.toBeNull();
    // ...but no sparkline SVG: the only stroked SVG left is the honest no-photo placeholder tile.
    expect(screen.getByTestId("decision-thumbnail-placeholder-meta-c1")).toBeInTheDocument();
  });

  it("renders no sparkline for a 1-point series — a single real day is not a trend", () => {
    renderCard(makeEntry({ trend: { metric: "ctr", points: [0.0182] } }));

    const spark = screen.queryByTestId("decision-sparkline-meta-c1");
    // The wrapper may exist, but `Sparkline` itself must draw nothing below 2 real points.
    expect(spark?.querySelector("svg") ?? null).toBeNull();
  });

  it("colors the line metric-aware, not sign-only: a rising CPL series is the bad tone, a rising CTR series the good one", () => {
    renderCard(makeEntry({ trend: { metric: "cpl", points: [80_000, 95_000, 120_000] } }));
    const cplPath = screen
      .getByTestId("decision-sparkline-meta-c1")
      .querySelector("svg path:last-of-type");
    expect(cplPath?.getAttribute("stroke")).toBe("var(--critical)");

    screen.getByTestId("decision-card-meta-c1").remove();
    renderCard(
      makeEntry({ campaignId: "meta-c2", trend: { metric: "ctr", points: [0.009, 0.014, 0.019] } }),
    );
    const ctrPath = screen
      .getByTestId("decision-sparkline-meta-c2")
      .querySelector("svg path:last-of-type");
    expect(ctrPath?.getAttribute("stroke")).toBe("var(--success)");
  });
});

describe("Samantha Attention Queue row sub-line (real diagnosis.evidence reasoning)", () => {
  it("uses the HIGHEST-SEVERITY real evidence entry's own reasoning string, verbatim", () => {
    renderCard(
      makeEntry({
        diagnosis: {
          ...makeEntry().diagnosis,
          evidence: [
            evidence({ severity: "LOW", reasoning: "Frequency naik sedikit." }),
            evidence({
              severity: "CRITICAL",
              reasoning: "CTR turun 50% dibanding periode sebelumnya.",
            }),
            evidence({ severity: "MEDIUM", reasoning: "CPL naik 12%." }),
          ],
        },
      }),
    );

    const subLine = screen.getByTestId("decision-subline-meta-c1");
    expect(subLine).toHaveTextContent("CTR turun 50% dibanding periode sebelumnya.");
    // The full real string is available on hover, so ellipsising never hides real text.
    expect(subLine).toHaveAttribute("title", "CTR turun 50% dibanding periode sebelumnya.");
  });

  it("falls back to the real human-readable root-cause label when there is genuinely no evidence", () => {
    renderCard(makeEntry());
    expect(screen.getByTestId("decision-subline-meta-c1")).toHaveTextContent("CTR Menurun");
  });
});

describe("Samantha Attention Queue tabs", () => {
  const critical = makeEntry({ campaignId: "c-crit" });
  const actionRequired = makeEntry({
    campaignId: "c-action",
    decision: { ...makeEntry().decision, impact: "HIGH" },
  });
  const scale = makeEntry({
    campaignId: "c-scale",
    decision: { ...makeEntry().decision, decision: "SCALE", impact: "LOW" },
  });
  const monitor = makeEntry({
    campaignId: "c-monitor",
    decision: { ...makeEntry().decision, decision: "MONITOR", impact: "LOW" },
  });
  const campaigns = [critical, actionRequired, scale, monitor];

  function renderQueue(): void {
    render(
      <SamanthaDecisionQueue
        queue={{ entries: [critical, actionRequired, scale], actionableCount: 3 }}
        campaigns={campaigns}
      />,
    );
  }

  it("shows `Label (n)` counts straight from the real per-tab predicates", () => {
    renderQueue();
    // ALL = real actionableCount; CRITICAL = impact === CRITICAL; ACTION_REQUIRED = actionable,
    // non-CRITICAL, HIGH/MEDIUM; OPPORTUNITIES = decision === SCALE; MONITORING = decision === MONITOR.
    expect(screen.getByTestId("decision-tab-ALL")).toHaveTextContent("All (3)");
    expect(screen.getByTestId("decision-tab-CRITICAL")).toHaveTextContent("Critical (1)");
    expect(screen.getByTestId("decision-tab-ACTION_REQUIRED")).toHaveTextContent(
      "Action Required (1)",
    );
    expect(screen.getByTestId("decision-tab-OPPORTUNITIES")).toHaveTextContent("Opportunities (1)");
    expect(screen.getByTestId("decision-tab-MONITORING")).toHaveTextContent("Monitoring (1)");
  });

  it("keeps Completed visibly disabled with an honest tooltip and NO fabricated count", () => {
    renderQueue();
    const completed = screen.getByTestId("decision-tab-COMPLETED");
    expect(completed).toBeDisabled();
    expect(completed).toHaveAttribute("title", expect.stringContaining("not available yet"));
    // The reference mockup shows `Completed (11)`; there is no real resolved-decision concept here,
    // so no number may appear.
    expect(completed.textContent).toBe("Completed");
    expect(completed.textContent).not.toMatch(/\d/);
  });

  it("gives the active pill a leading icon and the inactive pills none", () => {
    renderQueue();
    expect(screen.getByTestId("decision-tab-ALL").querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("decision-tab-CRITICAL").querySelector("svg")).toBeNull();
  });
});

describe("Samantha Attention Queue row Samantha Plan lines", () => {
  it("renders up to 2 REAL monitoringPlan.successConditions strings, with the full text on hover", () => {
    renderCard(
      makeEntry({
        decision: {
          ...makeEntry().decision,
          monitoringPlan: {
            reviewAfterHours: 48,
            successConditions: [
              "CTR kembali di atas baseline dalam 48 jam.",
              "CPL turun ke bawah target akun.",
              "Frequency turun di bawah 2.0.",
            ],
            rollbackConditions: [],
          },
        },
      }),
    );

    const card = screen.getByTestId("decision-card-meta-c1");
    expect(card).toHaveTextContent("CTR kembali di atas baseline dalam 48 jam.");
    expect(card).toHaveTextContent("CPL turun ke bawah target akun.");
    // Capped at 2 lines to keep the row compact — the 3rd real condition is not rendered here.
    expect(card).not.toHaveTextContent("Frequency turun di bawah 2.0.");
    expect(screen.getByTitle("CTR kembali di atas baseline dalam 48 jam.")).toBeInTheDocument();
  });

  it("falls back to the real decision.reason when there are genuinely no success conditions", () => {
    renderCard(makeEntry());
    expect(screen.getByTestId("decision-card-meta-c1")).toHaveTextContent(
      "Root cause CTR decreased terdeteksi.",
    );
  });
});

describe("Samantha Attention Queue row Approve Plan", () => {
  it("stays genuinely non-functional: disabled, with an honest tooltip, and no faked success path", () => {
    renderCard(makeEntry());
    const approve = screen.getByTestId("decision-approve-meta-c1");
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute(
      "title",
      expect.stringContaining("belum ada endpoint eksekusi"),
    );
  });

  it("keeps the row overflow affordance non-functional too", () => {
    renderCard(makeEntry());
    expect(screen.getByTestId("decision-overflow-meta-c1")).toBeDisabled();
  });
});
