import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GrowthObjectiveHero } from "@/components/growth/GrowthObjectiveHero";
import type { GrowthObjectiveResponseDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const objective: GrowthObjectiveResponseDto = {
  id: "go1",
  tenantId: "dss-motor",
  metric: "HOT_LEADS",
  targetValue: 500,
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  budgetMode: "BALANCED",
  automationMode: "ADVISOR",
  status: "ON_TRACK",
  progress: {
    actualValue: 220,
    targetValue: 500,
    percentComplete: 0.44,
    campaignsOnPace: 3,
    campaignsTotal: 5,
  },
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-15T00:00:00Z",
};

describe("GrowthObjectiveHero", () => {
  it("shows the real, honest empty state when the tenant has no objective", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ objectives: [] }))),
    );
    render(<GrowthObjectiveHero />);
    expect(await screen.findByText("🎯 Set your Growth Objective")).toBeInTheDocument();
    expect(screen.getByText("Create Growth Objective →")).toHaveAttribute(
      "href",
      "/growth-objectives",
    );
  });

  it("renders the real current/target value, progress/pace/status line for an active objective", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ objectives: [objective] }))),
    );
    render(<GrowthObjectiveHero />);
    await waitFor(() =>
      expect(screen.getByTestId("cc-objective-status")).toHaveTextContent("On track"),
    );
    // Real current/target big value, per spec section 5 ("38 / 50 HOT LEADS" style) — sourced
    // verbatim from `objective.progress.actualValue` / `objective.targetValue` (220 / 500), never a
    // paraphrased or invented number.
    expect(screen.getByText(/220\s*\/\s*500\s*HOT LEADS/)).toBeInTheDocument();
    expect(screen.getByTestId("cc-objective-status-line")).toHaveTextContent(
      "3 dari 5 campaign on pace.",
    );
    expect(screen.getByText("Review Plan →")).toHaveAttribute("href", "/growth-objectives");
  });

  it("shows a real error state when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network"))),
    );
    render(<GrowthObjectiveHero />);
    expect(await screen.findByText(/belum bisa dimuat/i)).toBeInTheDocument();
  });
});
