import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CampaignTable } from "@/components/meta-ads/CampaignTable";
import type { AdSetSummaryDto, AdSummaryDto, CampaignSummaryDto } from "@/types/dashboard.types";

/**
 * @tanstack/react-virtual needs a scroll container with a real, non-zero measured size to decide
 * which rows are "visible" and render them. Direct read of `@tanstack/virtual-core`'s real source
 * (`@tanstack/virtual-core`'s published `dist/esm/index.js`, `observeElementRect`'s `getRect`
 * helper) confirms the INITIAL measurement it uses is `element.offsetWidth`/`offsetHeight` —
 * NOT `getBoundingClientRect()` (only used as one of several ResizeObserver-entry fallbacks after
 * that). jsdom returns 0 for `offsetWidth`/`offsetHeight` by default, so without this stub the
 * virtualizer permanently believes the container is 0px and renders zero rows. `getBoundingClientRect`
 * is stubbed too since the `ResizeObserver` polyfill (`tests/setup.ts`) also reads it for its
 * synthetic callback. A common, documented pattern for testing `@tanstack/react-virtual` under jsdom.
 */
function stubViewportSize(): void {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    value: 800,
  });
  HTMLElement.prototype.getBoundingClientRect = vi.fn(
    () =>
      ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
}

function buildAd(overrides: Partial<AdSummaryDto> = {}): AdSummaryDto {
  return {
    id: "A001",
    metaId: "A001",
    stableId: "#C001",
    name: "#C001 Meta-DM-Leads-Mobix",
    status: "ACTIVE",
    funnel: "DM",
    branch: "BINTARO",
    verdict: "REVIEW",
    metrics: {
      spend: 6_000_000,
      clicks: 1200,
      frequency: 2.1,
      conversations: 790,
      d2: 400,
      d3: 307,
      d5: 100,
      leadForm: 20,
      totalLead: 320,
      rphD3: 19_541,
      rphLead: 18_750,
    },
    ...overrides,
  };
}

function buildAdSet(
  overrides: Partial<AdSetSummaryDto> = {},
  ads: readonly AdSummaryDto[] = [buildAd()],
): AdSetSummaryDto {
  return {
    id: "B001",
    metaId: "B001",
    stableId: "#B001",
    name: "#B001 Ad Set",
    status: "ACTIVE",
    spend: 6_000_000,
    dailyBudget: 3_000_000,
    ads,
    ...overrides,
  };
}

function buildCampaign(
  overrides: Partial<CampaignSummaryDto> = {},
  adSets: readonly AdSetSummaryDto[] = [buildAdSet()],
): CampaignSummaryDto {
  return {
    id: "CAMP001",
    metaId: "CAMP001",
    stableId: "#A001",
    name: "#A001 Meta-DM-Leads-Mobix",
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend: 6_000_000,
    dailyBudget: 0,
    adSets,
    ...overrides,
  };
}

describe("CampaignTable", () => {
  beforeEach(() => {
    stubViewportSize();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the Ads tab and renders a real ad row", () => {
    render(<CampaignTable campaigns={[buildCampaign()]} />);
    expect(screen.getByRole("tab", { name: "Ads" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("#C001 Meta-DM-Leads-Mobix")).toBeInTheDocument();
  });

  it("VerdictBadge shows the correct verdict via data-verdict", () => {
    render(
      <CampaignTable
        campaigns={[buildCampaign({}, [buildAdSet({}, [buildAd({ verdict: "PAUSE" })])])]}
      />,
    );
    expect(screen.getByTestId("verdict-badge")).toHaveAttribute("data-verdict", "PAUSE");
  });

  it("Execute button is visible and calls onExecute with the row's real id/level/verdict", async () => {
    const onExecute = vi.fn();
    render(<CampaignTable campaigns={[buildCampaign()]} onExecute={onExecute} />);
    const button = screen.getByRole("button", { name: /Execute/ });
    await userEvent.click(button);
    expect(onExecute).toHaveBeenCalledWith({ id: "A001", level: "ad", verdict: "REVIEW" });
  });

  it("shows an empty state when there are no campaigns", () => {
    render(<CampaignTable campaigns={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("switches to the Campaigns tab and shows a real, aggregated campaign row", async () => {
    const campaign = buildCampaign({}, [
      buildAdSet({ id: "B001", spend: 6_000_000 }, [buildAd({ id: "A001" })]),
      buildAdSet({ id: "B002", stableId: "#B002", spend: 4_000_000 }, [
        buildAd({ id: "A002", stableId: "#C002", verdict: "FIX" }),
      ]),
    ]);
    render(<CampaignTable campaigns={[campaign]} />);
    await userEvent.click(screen.getByRole("tab", { name: "Campaigns" }));
    expect(screen.getByTestId("campaign-table-row")).toHaveAttribute("data-level", "campaign");
    // FIX outranks REVIEW in VerdictEngine precedence — the aggregated campaign row must show it.
    expect(screen.getByTestId("verdict-badge")).toHaveAttribute("data-verdict", "FIX");
  });

  it("switches to the Ad Sets tab and shows a real ad-set row using its own authoritative spend", async () => {
    render(<CampaignTable campaigns={[buildCampaign()]} />);
    await userEvent.click(screen.getByRole("tab", { name: "Ad Sets" }));
    const row = screen.getByTestId("campaign-table-row");
    expect(row).toHaveAttribute("data-level", "adset");
    expect(within(row).getByText("#B001 Ad Set")).toBeInTheDocument();
  });

  it("Kolom menu toggles an optional column (Rp/Lead) on and off", async () => {
    render(<CampaignTable campaigns={[buildCampaign()]} />);
    // Scoped to the row area (not the "Kolom" checklist itself, which always lists every optional
    // column's label regardless of its checked state) — this asserts the METRIC cell's own
    // visibility, which is what real toggling controls.
    const tableArea = screen.getByTestId("campaign-table");
    expect(within(tableArea).queryByText("Rp/Lead")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("columns-toggle"));
    await userEvent.click(screen.getByRole("checkbox", { name: "Rp/Lead" }));
    expect(within(tableArea).getByText("Rp/Lead")).toBeInTheDocument();
  });

  it("hides the HOUSING column for AUTOMOTIVE (default/undefined vertical)", async () => {
    render(<CampaignTable campaigns={[buildCampaign()]} vertical="AUTOMOTIVE" />);
    await userEvent.click(screen.getByTestId("columns-toggle"));
    expect(screen.queryByRole("checkbox", { name: "HOUSING" })).not.toBeInTheDocument();
  });

  it("shows an honest 'belum tersedia' HOUSING badge for PROPERTY tenants, never a fabricated compliance status", async () => {
    render(<CampaignTable campaigns={[buildCampaign()]} vertical="PROPERTY" />);
    await userEvent.click(screen.getByTestId("columns-toggle"));
    await userEvent.click(screen.getByRole("checkbox", { name: "HOUSING" }));
    expect(screen.getByText("HOUSING: belum tersedia")).toBeInTheDocument();
  });

  it("flags a high-frequency ad row (>3.5) once the Frequency column is shown", async () => {
    render(
      <CampaignTable
        campaigns={[
          buildCampaign({}, [
            buildAdSet({}, [buildAd({ metrics: { ...buildAd().metrics, frequency: 4.0 } })]),
          ]),
        ]}
      />,
    );
    await userEvent.click(screen.getByTestId("columns-toggle"));
    await userEvent.click(screen.getByRole("checkbox", { name: "Frequency" }));
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });
});
