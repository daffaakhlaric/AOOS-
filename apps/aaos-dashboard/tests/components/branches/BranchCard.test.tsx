import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BranchCard } from "@/components/branches/BranchCard";
import type { BranchDto } from "@/types/dashboard.types";

const BRANCH: BranchDto = {
  id: "BINTARO",
  name: "Mobix Bintaro",
  displayName: "Cabang Bintaro",
  wabaPhoneNumber: "+628110000001",
  assignmentMode: "SMART_ASSIGN",
  maxLeadsPerSalesPerDay: 10,
  active: true,
  team: [],
  availableCount: 2,
  queueSize: 0,
  todayAssignedCount: 0,
};

describe("BranchCard", () => {
  it("renders the branch display name and phone number", () => {
    render(<BranchCard branch={BRANCH} />);
    expect(screen.getByText("Cabang Bintaro")).toBeInTheDocument();
    expect(screen.getByText(/\+628110000001/)).toBeInTheDocument();
  });

  it("shows an Active badge for an active branch", () => {
    render(<BranchCard branch={BRANCH} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows an Inactive badge for an inactive branch", () => {
    render(<BranchCard branch={{ ...BRANCH, active: false }} />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});
