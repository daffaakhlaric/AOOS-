import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WinningCombos } from "@/components/meta-ads/WinningCombos";
import type { HeatmapCellDto } from "@/types/dashboard.types";

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

describe("WinningCombos", () => {
  it("renders nothing when there are no cells", () => {
    const { container } = render(<WinningCombos cells={[]} metric="ctr" onOpenAsset={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders at most the top 3 cells ranked by the active metric", () => {
    const cells = [
      buildCell({ assetId: "low", ctr: 0.01 }),
      buildCell({ assetId: "high", ctr: 0.09 }),
      buildCell({ assetId: "mid", ctr: 0.05 }),
      buildCell({ assetId: "fourth", ctr: 0.03 }),
    ];
    render(<WinningCombos cells={cells} metric="ctr" onOpenAsset={vi.fn()} />);
    expect(screen.getByTestId("winning-combo-card-1")).toHaveTextContent("high");
    expect(screen.getByTestId("winning-combo-card-2")).toHaveTextContent("mid");
    expect(screen.getByTestId("winning-combo-card-3")).toHaveTextContent("fourth");
    expect(screen.queryByText(/low/)).not.toBeInTheDocument();
  });

  it("ranks by CPL ascending (lower is better)", () => {
    const cells = [
      buildCell({ assetId: "expensive", cpl: 100_000 }),
      buildCell({ assetId: "cheap", cpl: 20_000 }),
    ];
    render(<WinningCombos cells={cells} metric="cpl" onOpenAsset={vi.fn()} />);
    expect(screen.getByTestId("winning-combo-card-1")).toHaveTextContent("cheap");
  });

  it("calls onOpenAsset with the assetId when a card is clicked", async () => {
    const user = userEvent.setup();
    const onOpenAsset = vi.fn();
    render(
      <WinningCombos
        cells={[buildCell({ assetId: "hash-XYZ" })]}
        metric="ctr"
        onOpenAsset={onOpenAsset}
      />,
    );
    await user.click(screen.getByTestId("winning-combo-card-1"));
    expect(onOpenAsset).toHaveBeenCalledWith("hash-XYZ");
  });
});
