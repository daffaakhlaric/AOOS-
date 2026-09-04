import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HeatmapGrid } from "@/components/meta-ads/HeatmapGrid";
import type { HeatmapCellDto, HeatmapResponseDto } from "@/types/dashboard.types";

function buildCell(overrides: Partial<HeatmapCellDto> = {}): HeatmapCellDto {
  return {
    assetKind: "IMAGE",
    assetId: "hash-A",
    audienceLabel: "BROAD",
    adCount: 3,
    spend: 1_000_000,
    impressions: 20_000,
    clicks: 400,
    totalLead: 20,
    maxFrequency: 2.1,
    ctr: 0.02,
    cpm: 50_000,
    cpl: 50_000,
    ...overrides,
  };
}

function buildHeatmap(overrides: Partial<HeatmapResponseDto> = {}): HeatmapResponseDto {
  const cells = overrides.cells ?? [buildCell()];
  return {
    adAccountId: "act_752604553578354",
    generatedAt: "2026-08-31T00:00:00.000Z",
    cells,
    creativeAssetIds: [...new Set(cells.map((c) => c.assetId))],
    audienceLabels: [...new Set(cells.map((c) => c.audienceLabel))],
    untaggedAdCount: 0,
    benchmarkCplIDR: 40_000,
    insightText: "Kombinasi kreatif hash-A × audiens BROAD memiliki CPL terendah.",
    ...overrides,
  };
}

describe("HeatmapGrid", () => {
  it("renders an empty state when there are no columns/rows", () => {
    render(
      <HeatmapGrid
        heatmap={buildHeatmap({ cells: [], creativeAssetIds: [], audienceLabels: [] })}
      />,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders the grid with one column per creativeAssetIds entry and one row per audienceLabels entry", () => {
    const cells = [
      buildCell({ assetId: "hash-A", audienceLabel: "BROAD" }),
      buildCell({ assetId: "hash-A", audienceLabel: "INTEREST" }),
      buildCell({ assetId: "hash-B", audienceLabel: "BROAD" }),
    ];
    render(
      <HeatmapGrid
        heatmap={buildHeatmap({
          cells,
          creativeAssetIds: ["hash-A", "hash-B"],
          audienceLabels: ["BROAD", "INTEREST"],
        })}
      />,
    );
    const grid = screen.getByTestId("heatmap-grid");
    expect(within(grid).getAllByText("Broad")).toHaveLength(1);
    expect(within(grid).getAllByText("Interest")).toHaveLength(1);
    // 3 real cells + 1 empty cell (hash-B × INTEREST, no data for that pair).
    expect(within(grid).getAllByTestId("heatmap-cell")).toHaveLength(3);
    expect(within(grid).getAllByTestId("heatmap-cell-empty")).toHaveLength(1);
  });

  it("defaults to the CPL metric and shows CPL values formatted as Rupiah", () => {
    render(<HeatmapGrid heatmap={buildHeatmap({ cells: [buildCell({ cpl: 12_345 })] })} />);
    expect(screen.getByText("Rp 12.345")).toBeInTheDocument();
  });

  it("switches to CTR when the CTR toggle is clicked, showing a percentage instead of Rupiah", async () => {
    const user = userEvent.setup();
    render(<HeatmapGrid heatmap={buildHeatmap({ cells: [buildCell({ ctr: 0.05 })] })} />);
    await user.click(screen.getByRole("button", { name: "CTR" }));
    expect(screen.getByText("5%")).toBeInTheDocument();
  });

  it("switches to CPM when the CPM toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<HeatmapGrid heatmap={buildHeatmap({ cells: [buildCell({ cpm: 75_000 })] })} />);
    await user.click(screen.getByRole("button", { name: "CPM" }));
    const cell = screen.getByTestId("heatmap-cell");
    expect(cell.textContent).toContain("Rp");
  });

  it("shows a dash for a metric value that is null (division-safe, never a fabricated number)", () => {
    render(<HeatmapGrid heatmap={buildHeatmap({ cells: [buildCell({ cpl: null })] })} />);
    const cell = screen.getByTestId("heatmap-cell");
    expect(cell.textContent).toContain("—");
  });

  it("links each populated cell to /meta-ads/analytics/assets/{assetId}", () => {
    render(<HeatmapGrid heatmap={buildHeatmap({ cells: [buildCell({ assetId: "hash-XYZ" })] })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/meta-ads/analytics/assets/hash-XYZ");
  });

  it("renders the deterministic insightText below the grid", () => {
    render(
      <HeatmapGrid heatmap={buildHeatmap({ insightText: "Some deterministic insight text." })} />,
    );
    expect(screen.getByTestId("heatmap-insight")).toHaveTextContent(
      "Some deterministic insight text.",
    );
  });

  it("shows the untagged ad count note only when untaggedAdCount is greater than 0", () => {
    const { rerender } = render(<HeatmapGrid heatmap={buildHeatmap({ untaggedAdCount: 0 })} />);
    expect(screen.queryByText(/tidak tampil di heatmap/)).not.toBeInTheDocument();

    rerender(<HeatmapGrid heatmap={buildHeatmap({ untaggedAdCount: 5 })} />);
    expect(screen.getByText(/tidak tampil di heatmap/)).toBeInTheDocument();
  });
});
