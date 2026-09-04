import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BranchSummary, type BranchSummaryRow } from "@/components/dashboard/BranchSummary";

const ROWS: readonly BranchSummaryRow[] = [
  { branchId: "BINTARO", displayName: "Bintaro", leadsTotal: 4, hotCount: 3, spkThisMonth: 1 },
  { branchId: "CINERE", displayName: "Cinere", leadsTotal: 4, hotCount: 4, spkThisMonth: 1 },
  { branchId: "UMUM", displayName: "Umum", leadsTotal: 1, hotCount: 0, spkThisMonth: 0 },
];

describe("BranchSummary", () => {
  it("renders one card per real branch with leads total / HOT count / SPK bulan ini", () => {
    render(<BranchSummary rows={ROWS} />);
    expect(screen.getByTestId("branch-summary").children).toHaveLength(3);
    expect(screen.getByText("Bintaro")).toBeInTheDocument();
    expect(screen.getAllByText("4 leads total")).toHaveLength(2);
    expect(screen.getByText("3 HOT")).toBeInTheDocument();
    expect(screen.getByText("0 HOT")).toBeInTheDocument();
    expect(screen.getAllByText("1 SPK bulan ini")).toHaveLength(2);
  });

  it("links to the real /branches (Branch Settings) page", () => {
    render(<BranchSummary rows={ROWS} />);
    expect(screen.getByRole("link", { name: /Branch Settings/ })).toHaveAttribute(
      "href",
      "/branches",
    );
  });
});
