import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutomationHubClient } from "@/components/automation/AutomationHubClient";
import type { AutomationMode, GrowthObjectiveResponseDto } from "@/types/growth-objective.types";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";
import type { SettingsDto } from "@/types/tenant.types";

function settings(overrides: Partial<SettingsDto["tenant"]> = {}): SettingsDto {
  return {
    tenant: {
      tenantId: "tenant-1",
      name: "Tenant 1",
      vertical: "PROPERTY",
      status: "ACTIVE",
      mode: "DEV",
      operatingMode: "FULL_CONTROL",
      ...overrides,
    },
    meta: {
      apiVersion: "v21.0",
      hasToken: true,
      usingEnvDefault: false,
    },
  };
}

function propertyObjective(overrides: Partial<PropertyObjectiveDto> = {}): PropertyObjectiveDto {
  return {
    id: "po-1",
    tenantId: "tenant-1",
    period: { month: 9, year: 2026 },
    targetHotLeads: 50,
    budgetAllocation: 30_000_000,
    budgetSource: "MANUAL",
    focusListings: ["Rumah A"],
    areaPriorities: ["Bintaro"],
    status: "ACTIVE",
    createdAt: "2026-09-01T00:00:00.000Z",
    maxAutoBriefsPerDay: 3,
    autoApproveCreativeBrief: false,
    autoPublishCampaign: false,
    maxBudgetIncreasePct: 20,
    ...overrides,
  };
}

function growthObjective(
  id: string,
  automationMode: AutomationMode,
  overrides: Partial<GrowthObjectiveResponseDto> = {},
): GrowthObjectiveResponseDto {
  return {
    id,
    tenantId: "tenant-1",
    metric: "HOT_LEADS",
    targetValue: 50,
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    budgetMode: "GOAL_FIRST",
    focusListingIds: [],
    areaStrategy: "SAMANTHA",
    manualAreas: [],
    automationMode,
    status: "ACTIVE",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

interface MockOptions {
  readonly settingsStatus?: number;
  readonly settingsBody?: SettingsDto;
  readonly propertyObjectiveStatus?: number;
  readonly propertyObjective?: PropertyObjectiveDto | null;
  readonly growthObjectivesStatus?: number;
  readonly growthObjectives?: readonly GrowthObjectiveResponseDto[];
}

function mockFetch(options: MockOptions = {}): void {
  const {
    settingsStatus = 200,
    settingsBody = settings(),
    propertyObjectiveStatus = 200,
    propertyObjective: objective = propertyObjective(),
    growthObjectivesStatus = 200,
    growthObjectives = [],
  } = options;

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/settings")) {
        return Promise.resolve(
          new Response(JSON.stringify(settingsBody), { status: settingsStatus }),
        );
      }
      if (url.startsWith("/api/property-objective")) {
        return Promise.resolve(
          new Response(JSON.stringify({ objective }), { status: propertyObjectiveStatus }),
        );
      }
      if (url.startsWith("/api/growth-objectives")) {
        return Promise.resolve(
          new Response(JSON.stringify({ objectives: growthObjectives }), {
            status: growthObjectivesStatus,
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
    }),
  );
}

describe("AutomationHubClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the honest 'not wired to execution' notice unconditionally", async () => {
    mockFetch();
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-policy-not-wired-notice")).toBeInTheDocument(),
    );
    expect(screen.getByText(/BELUM disambungkan ke eksekusi nyata mana pun/)).toBeInTheDocument();
  });

  it("renders the real DEV/LIVE tenant mode from GET /api/settings", async () => {
    mockFetch({ settingsBody: settings({ mode: "LIVE" }) });
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-mode-operasi-value")).toHaveTextContent("LIVE"),
    );
  });

  it("honestly degrades the Mode Operasi section when GET /api/settings fails", async () => {
    mockFetch({ settingsStatus: 500 });
    render(<AutomationHubClient />);
    await waitFor(() => expect(screen.getAllByTestId("error-card").length).toBeGreaterThan(0));
    expect(screen.queryByTestId("automation-mode-operasi-value")).not.toBeInTheDocument();
  });

  it("renders the real auto-publish guardrail values for a PROPERTY tenant", async () => {
    mockFetch({
      settingsBody: settings({ vertical: "PROPERTY" }),
      propertyObjective: propertyObjective({ autoPublishCampaign: true, maxBudgetIncreasePct: 15 }),
    });
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-auto-publish-value")).toHaveTextContent("Aktif"),
    );
    expect(screen.getByTestId("automation-max-budget-increase")).toHaveTextContent("15%");
  });

  it("shows an honest empty state for Automasi Campaign when the PROPERTY tenant has no objective yet", async () => {
    mockFetch({ settingsBody: settings({ vertical: "PROPERTY" }), propertyObjective: null });
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByText("Belum ada Objective bulan ini")).toBeInTheDocument(),
    );
  });

  it("shows an honest non-applicable state for Automasi Campaign on an AUTOMOTIVE tenant, never a fabricated value", async () => {
    mockFetch({ settingsBody: settings({ vertical: "AUTOMOTIVE" }) });
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByText("Guardrail ini khusus tenant PROPERTY")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("automation-auto-publish-value")).not.toBeInTheDocument();
  });

  it("computes real per-mode counts from every fetched growth objective", async () => {
    mockFetch({
      growthObjectives: [
        growthObjective("go-1", "ADVISOR"),
        growthObjective("go-2", "ADVISOR"),
        growthObjective("go-3", "ADVISOR"),
        growthObjective("go-4", "COPILOT"),
      ],
    });
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-mode-counts")).toHaveTextContent(
        "3 Advisor · 1 Copilot · 0 Guarded Autopilot · 0 Autonomous",
      ),
    );
  });

  it("shows an honest empty state when there are zero growth objectives", async () => {
    mockFetch({ growthObjectives: [] });
    render(<AutomationHubClient />);
    await waitFor(() => expect(screen.getByText("Belum ada Growth Objective")).toBeInTheDocument());
    expect(screen.queryByTestId("automation-mode-counts")).not.toBeInTheDocument();
  });

  it("lists real objectives in AUTOPILOT_GUARDED/AUTONOMOUS mode, linking to their detail page", async () => {
    mockFetch({
      growthObjectives: [
        growthObjective("go-guarded", "AUTOPILOT_GUARDED", { targetValue: 80 }),
        growthObjective("go-autonomous", "AUTONOMOUS", { targetValue: 120 }),
        growthObjective("go-advisor", "ADVISOR"),
      ],
    });
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-lower-oversight-list")).toBeInTheDocument(),
    );
    const list = screen.getByTestId("automation-lower-oversight-list");
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/growth-objectives/go-guarded");
    expect(links[1]).toHaveAttribute("href", "/growth-objectives/go-autonomous");
  });

  it("shows an honest 'no lower-oversight objectives' note when none exist", async () => {
    mockFetch({ growthObjectives: [growthObjective("go-1", "ADVISOR")] });
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-no-lower-oversight")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("automation-lower-oversight-list")).not.toBeInTheDocument();
  });

  it("honestly degrades the Automation Mode per Objective section when GET /api/growth-objectives fails, independent of the other sections", async () => {
    mockFetch({ growthObjectivesStatus: 500, settingsBody: settings({ mode: "LIVE" }) });
    render(<AutomationHubClient />);
    await waitFor(() =>
      expect(screen.getByTestId("automation-mode-operasi-value")).toHaveTextContent("LIVE"),
    );
    await waitFor(() => expect(screen.getAllByTestId("error-card").length).toBeGreaterThan(0));
    expect(screen.queryByTestId("automation-mode-counts")).not.toBeInTheDocument();
  });
});
