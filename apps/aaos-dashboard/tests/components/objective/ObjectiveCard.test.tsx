import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ObjectiveCard } from "@/components/objective/ObjectiveCard";
import type { ObjectiveDto } from "@/types/dashboard.types";

const OBJECTIVE: ObjectiveDto = {
  id: "obj-1",
  tenantId: "dss-motor",
  period: { month: 8, year: 2026 },
  targetHotLeads: 50,
  budgetAllocation: 30_000_000,
  focusUnits: ["Xpander", "Brio"],
  areaPriorities: ["BINTARO"],
  status: "DRAFT",
  createdAt: "2026-08-01T00:00:00.000Z",
};

describe("ObjectiveCard", () => {
  it("renders the target and budget", () => {
    render(<ObjectiveCard objective={OBJECTIVE} />);
    expect(screen.getByText(/Target 50 hot leads/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 30\.000\.000/)).toBeInTheDocument();
  });

  it("renders focus units and area priorities", () => {
    render(<ObjectiveCard objective={OBJECTIVE} />);
    expect(screen.getByText(/Xpander, Brio/)).toBeInTheDocument();
    expect(screen.getByText(/BINTARO/)).toBeInTheDocument();
  });
});
