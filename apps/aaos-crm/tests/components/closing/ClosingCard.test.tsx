import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClosingCard } from "@/components/closing/ClosingCard";
import type { ClosingDto } from "@/types/crm.types";

function makeClosing(overrides: Partial<ClosingDto> = {}): ClosingDto {
  return {
    id: "closing-1",
    leadId: "lead-1",
    salesHumanId: "sales-rina",
    branchId: "CINERE",
    closingType: "SPK",
    unitModel: "Xpander Cross AT 2020",
    commissionIdr: 5_850_000,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ClosingCard", () => {
  it("renders unit model and closing type label", () => {
    render(<ClosingCard closing={makeClosing()} />);
    expect(screen.getByText("Xpander Cross AT 2020")).toBeInTheDocument();
    expect(screen.getByText("SPK")).toBeInTheDocument();
  });

  it("renders commission formatted as IDR", () => {
    render(<ClosingCard closing={makeClosing()} />);
    expect(screen.getByText(/5\.850\.000/)).toBeInTheDocument();
  });

  it("falls back to a placeholder when unitModel is missing", () => {
    render(<ClosingCard closing={makeClosing({ unitModel: undefined })} />);
    expect(screen.getByText("Unit tidak diisi")).toBeInTheDocument();
  });
});
