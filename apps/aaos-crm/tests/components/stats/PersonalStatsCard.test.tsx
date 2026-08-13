import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PersonalStatsCard } from "@/components/stats/PersonalStatsCard";

describe("PersonalStatsCard", () => {
  it("renders 4 stat tiles", () => {
    render(
      <PersonalStatsCard
        stats={{
          leadsToday: 3,
          testDriveThisMonth: 5,
          spkThisMonth: 2,
          commissionThisMonthIdr: 11_700_000,
          recentClosings: [],
        }}
      />,
    );
    expect(screen.getByTestId("personal-stats-card").children).toHaveLength(4);
  });

  it("komisi is formatted as compact IDR", () => {
    render(
      <PersonalStatsCard
        stats={{
          leadsToday: 3,
          testDriveThisMonth: 5,
          spkThisMonth: 2,
          commissionThisMonthIdr: 11_700_000,
          recentClosings: [],
        }}
      />,
    );
    expect(screen.getByText("Rp 11.7jt")).toBeInTheDocument();
  });

  it("renders leads-today/test-drive/spk counts", () => {
    render(
      <PersonalStatsCard
        stats={{
          leadsToday: 3,
          testDriveThisMonth: 5,
          spkThisMonth: 2,
          commissionThisMonthIdr: 0,
          recentClosings: [],
        }}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
