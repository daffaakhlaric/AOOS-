import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import { CampaignTabs } from "@/components/campaigns/CampaignTabs";
import { mapCampaignPortfolioItem, type PortfolioCampaign } from "@/lib/campaigns";
import type { CampaignHealthDto, HealthStatus } from "@/types/dashboard.types";
function makeHealth(overallStatus: HealthStatus): CampaignHealthDto {
  const dim = { status: overallStatus, confidence: 1, issues: [] as string[] };
  const unknown = { status: "UNKNOWN" as HealthStatus, confidence: 0, issues: [] as string[] };
  return {
    delivery: dim,
    costEfficiency: dim,
    creative: dim,
    audience: unknown,
    conversion: dim,
    tracking: unknown,
    leadQuality: unknown,
    overallStatus,
  };
}
const item = mapCampaignPortfolioItem({
  id: "c",
  metaId: "campaign",
  stableId: "A1",
  name: "Test campaign",
  objective: "LEADS",
  status: "ACTIVE",
  spend: 100,
  dailyBudget: 10,
  accountId: "account",
  accountName: "Account",
  syncedAt: "2026-09-21",
  adSets: [
    {
      id: "s",
      metaId: "s",
      stableId: "B1",
      name: "Ad set",
      status: "ACTIVE",
      spend: 100,
      dailyBudget: 10,
      ads: [
        {
          id: "a",
          metaId: "ad",
          stableId: "C1",
          name: "Real creative",
          status: "ACTIVE",
          verdict: "KEEP",
          metrics: { spend: 100, clicks: 10, impressions: 1000, frequency: 1, totalLead: 2 },
        },
      ],
    },
  ],
} as PortfolioCampaign);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows unassessed instead of fabricating a healthy creative", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="creative" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  expect(await screen.findByText("C1 · Real creative")).toBeInTheDocument();
  expect(screen.getByTestId("card-health-pill")).toHaveTextContent("Unassessed");
  fireEvent.change(screen.getByLabelText("Filter status"), { target: { value: "Winner" } });
  expect(screen.getByText("Tidak ada creative sesuai filter")).toBeInTheDocument();
});
it("renders experiment outcomes and related Kai variants from linked records", async () => {
  const data = {
    tests: [
      {
        id: "test",
        campaignId: "campaign",
        name: "Angle test",
        status: "COMPLETE",
        thresholdSpend: 50,
        thresholdDays: 1,
        minMarginPct: 20,
        winnerVariantId: "v",
        variants: [
          {
            id: "v",
            variantLabel: "A",
            angle: "INVESTASI",
            status: "WINNER",
            creativePackageId: "pkg",
            metaAdId: "ad",
            spend: 100,
            leads: 5,
          },
        ],
      },
    ],
    packages: [],
    leads: [],
    activities: [],
    errors: [],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  render(
    <CampaignTabs
      item={item}
      tab="experiments"
      onTab={vi.fn()}
      history={[]}
      historyError={false}
    />,
  );
  expect(await screen.findByText("Angle test")).toBeInTheDocument();
  expect(screen.getAllByText("Winner selected").length).toBeGreaterThan(0);
});
it("renders honest gaps for CRM-stage metrics and keeps template CTAs inert", async () => {
  const data = {
    tests: [
      {
        id: "test",
        campaignId: "campaign",
        name: "Angle test",
        status: "COMPLETE",
        thresholdSpend: 50,
        thresholdDays: 1,
        minMarginPct: 20,
        winnerVariantId: "v",
        improvementPct: 18,
        variants: [
          {
            id: "v",
            variantLabel: "A",
            angle: "INVESTASI",
            status: "WINNER",
            creativePackageId: "pkg",
            metaAdId: "ad",
            spend: 100,
            leads: 5,
          },
        ],
      },
    ],
    packages: [],
    leads: [],
    activities: [],
    errors: [],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  render(
    <CampaignTabs
      item={item}
      tab="experiments"
      onTab={vi.fn()}
      history={[]}
      historyError={false}
    />,
  );
  await screen.findByText("Angle test");
  // Hasil Eksperimen: Hot Lead Rate/CPQL/Qualified Leads/Booking Rate are honest gaps ("—"), never
  // a fabricated value matching a mockup's exact numbers.
  expect(screen.getByText("Hot Lead Rate")).toBeInTheDocument();
  expect(screen.getByText("CPQL")).toBeInTheDocument();
  expect(screen.getByText("Qualified Leads")).toBeInTheDocument();
  expect(screen.getByText("Booking Rate")).toBeInTheDocument();
  // Template CTAs stay genuinely inert (disabled + honest tooltip), never silently broken.
  const templateButtons = screen.getAllByText("Pilih Template");
  expect(templateButtons.length).toBe(6);
  for (const button of templateButtons) {
    expect(button).toBeDisabled();
  }
  expect(screen.getByText("＋ Buat Eksperimen Baru")).toBeDisabled();
});
it("renders Meta delivery status separately from the creative health pill", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="creative" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByText("C1 · Real creative");
  const healthPill = screen.getByTestId("card-health-pill");
  const metaPill = screen.getByTestId("card-meta-status-pill");
  expect(healthPill).toHaveTextContent("Unassessed");
  expect(metaPill).toHaveTextContent("Active");
  expect(healthPill).not.toBe(metaPill);
});
it("keeps CPQL and Hot Lead Rate honest '—' placeholders on a real creative card", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="creative" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByText("C1 · Real creative");
  expect(screen.getByText("CPQL")).toBeInTheDocument();
  expect(screen.getByText("Hot Lead Rate")).toBeInTheDocument();
});
it("disables View Full Analysis honestly when the campaign has no real assessment", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="creative" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByText("C1 · Real creative");
  expect(screen.getByRole("button", { name: "View Full Analysis →" })).toBeDisabled();
});
it("toggles a state summary card as the status filter, same real predicate as the dropdown", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="creative" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByText("C1 · Real creative");
  fireEvent.click(screen.getByRole("button", { name: /^Winner 0/ }));
  expect(screen.getByText("Tidak ada creative sesuai filter")).toBeInTheDocument();
  // Clicking the same, already-active state card again clears the filter back to All.
  fireEvent.click(screen.getByRole("button", { name: /^Winner 0/ }));
  expect(screen.getByText("C1 · Real creative")).toBeInTheDocument();
});
it("portals Creative Actions/Insights/Distribution into the page's real rail slot when one is mounted", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  const slot = document.createElement("div");
  document.body.appendChild(slot);
  const view = render(
    <CampaignTabs
      item={item}
      tab="creative"
      onTab={vi.fn()}
      history={[]}
      historyError={false}
      creativeRailSlot={slot}
    />,
  );
  await screen.findByText("C1 · Real creative");
  // Rendered via the portal, into `slot` — not inside CampaignTabs' own container.
  expect(slot.querySelector("h3")?.textContent).toBe("Creative Actions");
  expect(view.container.textContent).not.toContain("Creative Actions");
  document.body.removeChild(slot);
});
it("toggles between Card View and Table View for the same real creative", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="creative" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByText("C1 · Real creative");
  fireEvent.click(screen.getByRole("button", { name: "Table View" }));
  expect(screen.getByText("Meta status")).toBeInTheDocument();
  expect(screen.getByText("C1 · Real creative")).toBeInTheDocument();
});
it("opens the creative detail drawer with real lineage and honest lead-quality gaps", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="creative" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByText("C1 · Real creative");
  fireEvent.click(screen.getByRole("button", { name: "View Details" }));
  expect(await screen.findByText("Creative detail")).toBeInTheDocument();
  expect(
    screen.getByText("Creative ini belum tertaut ke paket Kai — lineage dan QA belum tersedia."),
  ).toBeInTheDocument();
  expect(screen.getByText(/first-message intelligence belum tersedia/)).toBeInTheDocument();
});
it("does not turn failed supporting reads into successful zero lead data", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: ["Lead quality belum dapat dimuat."] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="leads" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  expect(await screen.findByText("Data Clara belum tersedia.")).toBeInTheDocument();
  expect(screen.queryByText("Belum ada lead dengan campaign ID ini.")).not.toBeInTheDocument();
});
it("shows INSUFFICIENT_DATA Samantha posture and a disabled View Full Analysis with zero leads", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="leads" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  const hero = await screen.findByTestId("lead-quality-hero");
  expect(hero).toHaveTextContent("Insufficient data");
  expect(screen.getByText("Belum ada lead teratribusi ke campaign ini.")).toBeInTheDocument();
  const analysisButtons = screen.getAllByRole("button", { name: "View Full Analysis →" });
  expect(analysisButtons[0]).toBeDisabled();
});
it("keeps CPQL, Appointment, Survey, and Booking honest '—' everywhere in Lead Quality, never fabricated", async () => {
  const leads = Array.from({ length: 6 }, (_, i) => ({
    id: `lead-${i}`,
    status: i < 2 ? "HOT" : "NEW",
    temperature: i < 2 ? "HOT" : i < 4 ? "WARM" : "COLD",
    score: 10,
    createdAt: "2026-09-20T00:00:00Z",
    contacted: i < 3,
    qualifiedAt: i < 2 ? "2026-09-21T00:00:00Z" : undefined,
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads, tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="leads" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByTestId("lead-quality-hero");
  // Funnel: Appointment/Survey/Booking real stages stay honest "—" (also appear as table headers).
  expect(screen.getAllByText("Appointment").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Survey").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Booking").length).toBeGreaterThan(0);
  // Stats CPQL stays honest.
  expect(screen.getAllByText("CPQL").length).toBeGreaterThan(0);
  // Lead Quality by Creative table's honest-gap columns and its visible attribution note.
  expect(screen.getByText(/Atribusi lead-ke-creative belum tersedia/)).toBeInTheDocument();
  expect(screen.getByText("Hot Lead Rate")).toBeInTheDocument();
});
it("renders the disconnected Respon Pintar state, never a fabricated 'Connected' status", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  const slot = document.createElement("div");
  document.body.appendChild(slot);
  render(
    <CampaignTabs
      item={item}
      tab="leads"
      onTab={vi.fn()}
      history={[]}
      historyError={false}
      creativeRailSlot={slot}
    />,
  );
  await screen.findByTestId("lead-quality-hero");
  expect(slot.textContent).toContain("Respon Pintar belum terhubung");
  expect(slot.textContent).not.toContain("Connected");
  const configureButton = within(slot).getByRole("button", { name: "Configure Integration" });
  expect(configureButton).toBeDisabled();
  document.body.removeChild(slot);
});
it("renders an honest unavailable state for First Message Intelligence, never fabricated intent bars", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="leads" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByTestId("lead-quality-hero");
  expect(screen.getByText("First Message Intelligence")).toBeInTheDocument();
  expect(screen.getByText(/Belum ada capture atau klasifikasi pesan pertama/)).toBeInTheDocument();
});
it("shows a real SCALE decision as the Budget hero posture, never an invented vocabulary label", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  const scaledItem = mapCampaignPortfolioItem(item.campaign, {
    campaignId: "campaign",
    campaignName: "Test campaign",
    spend: 100,
    health: makeHealth("HEALTHY"),
    diagnosis: {
      rootCause: "CTR_IMPROVEMENT",
      confidence: 0.82,
      impact: "MEDIUM",
      evidence: [],
      contributingFactors: [],
      recommendedFocus: [],
    },
    decision: {
      decision: "SCALE",
      confidence: 0.82,
      impact: "MEDIUM",
      reason: "CTR_IMPROVEMENT terdeteksi.",
      riskOfDoingNothing: "Momentum positif tidak dimanfaatkan.",
      expectedOutcome: "Scaling berpotensi memperbesar hasil positif.",
      monitoringPlan: {
        reviewAfterHours: 72,
        successConditions: [],
        rollbackConditions: ["CPL naik setelah scaling."],
      },
    },
  });
  render(
    <CampaignTabs
      item={scaledItem}
      tab="budget"
      onTab={vi.fn()}
      history={[]}
      historyError={false}
    />,
  );
  const hero = await screen.findByTestId("budget-decision-hero");
  expect(within(hero).getByText("Scale campaign")).toBeInTheDocument();
  expect(within(hero).getByText("82%")).toBeInTheDocument();
  expect(screen.getAllByText(/CPL naik setelah scaling/).length).toBeGreaterThan(0);
  // No invented vocabulary anywhere on the tab.
  expect(
    screen.queryByText(/WAIT_FOR_DATA|FIX_TRACKING_FIRST|REFRESH_CREATIVE_FIRST|REALLOCATE/),
  ).toBeNull();
});
it("keeps Impact Estimate and Allowed Change Now honest gaps, and Apply Budget Change disabled", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  render(
    <CampaignTabs item={item} tab="budget" onTab={vi.fn()} history={[]} historyError={false} />,
  );
  await screen.findByTestId("budget-decision-hero");
  expect(screen.getByText("Impact estimate unavailable")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apply Budget Change" })).toBeDisabled();
  expect(screen.getAllByText("Belum terhubung").length).toBeGreaterThan(0);
});
it("computes the one real Potential Waste category from real fatigued-creative spend", async () => {
  const fatiguedItem = mapCampaignPortfolioItem({
    ...item.campaign,
    adSets: [
      {
        id: "s",
        metaId: "s",
        stableId: "B1",
        name: "Ad set",
        status: "ACTIVE",
        spend: 100,
        dailyBudget: 10,
        ads: [
          {
            id: "a",
            metaId: "ad",
            stableId: "C1",
            name: "Real creative",
            status: "ACTIVE",
            verdict: "KEEP",
            metrics: { spend: 100, clicks: 10, impressions: 1000, frequency: 1, totalLead: 2 },
          },
        ],
      },
    ],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        leads: [],
        tests: [],
        packages: [
          {
            id: "pkg",
            campaignId: "campaign",
            adId: "ad",
            title: "Pkg",
            status: "APPROVED",
            fatigueStatus: "FATIGUED",
            createdAt: "2026-09-01",
          },
        ],
        activities: [],
        errors: [],
      }),
    }),
  );
  render(
    <CampaignTabs
      item={fatiguedItem}
      tab="budget"
      onTab={vi.fn()}
      history={[]}
      historyError={false}
    />,
  );
  await screen.findByTestId("budget-decision-hero");
  expect(
    await screen.findByText(/potential waste pada 1 creative berstatus Fatigued/),
  ).toBeInTheDocument();
  expect(screen.getAllByText(/Rp\s?100/).length).toBeGreaterThan(0);
});
it("portals Budget Guardrails and Budget Insights into the page rail, honest gap for Guardrails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leads: [], tests: [], packages: [], activities: [], errors: [] }),
    }),
  );
  const slot = document.createElement("div");
  document.body.appendChild(slot);
  render(
    <CampaignTabs
      item={item}
      tab="budget"
      onTab={vi.fn()}
      history={[]}
      historyError={false}
      creativeRailSlot={slot}
    />,
  );
  await screen.findByTestId("budget-decision-hero");
  expect(within(slot).getByText("Budget Guardrails")).toBeInTheDocument();
  expect(within(slot).getByText("Belum terhubung")).toBeInTheDocument();
  expect(within(slot).getByText("Budget Insights")).toBeInTheDocument();
  document.body.removeChild(slot);
});
