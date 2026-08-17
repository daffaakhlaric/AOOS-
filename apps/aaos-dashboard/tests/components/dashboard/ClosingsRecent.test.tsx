import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClosingsRecent } from "@/components/dashboard/ClosingsRecent";
import type { ClosingDto } from "@/types/dashboard.types";

function buildClosing(overrides: Partial<ClosingDto> = {}): ClosingDto {
  return {
    id: "closing-1",
    leadId: "lead-1",
    salesHumanId: "sales-1",
    branchId: "CINERE",
    closingType: "SPK",
    unitModel: "Xpander Cross AT 2019",
    commissionIdr: 5_850_000,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ClosingsRecent", () => {
  it("shows an empty state when there are no closings", () => {
    render(<ClosingsRecent closings={[]} salesNameById={{}} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders unit, cabang, resolved sales name, closing type, and commission", () => {
    render(
      <ClosingsRecent closings={[buildClosing()]} salesNameById={{ "sales-1": "Ahmad Fauzi" }} />,
    );
    expect(screen.getByText("Xpander Cross AT 2019")).toBeInTheDocument();
    expect(screen.getByText(/CINERE · Ahmad Fauzi · SPK/)).toBeInTheDocument();
    expect(screen.getByText("Rp 5,8 jt")).toBeInTheDocument();
  });

  it("falls back to the raw salesHumanId when it isn't found in the roster", () => {
    render(<ClosingsRecent closings={[buildClosing()]} salesNameById={{}} />);
    expect(screen.getByText(/CINERE · sales-1 · SPK/)).toBeInTheDocument();
  });

  it("shows '—' for commission when the closing has none (e.g. a test drive)", () => {
    render(
      <ClosingsRecent
        closings={[buildClosing({ closingType: "TEST_DRIVE", commissionIdr: undefined })]}
        salesNameById={{}}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("limits the list to the 3 most recent closings", () => {
    const closings = Array.from({ length: 5 }, (_, i) =>
      buildClosing({
        id: `closing-${i}`,
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
      }),
    );
    render(<ClosingsRecent closings={closings} salesNameById={{}} />);
    expect(screen.getByTestId("closings-recent").children).toHaveLength(3);
  });
});
