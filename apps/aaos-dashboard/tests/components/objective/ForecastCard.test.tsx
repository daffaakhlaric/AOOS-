import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ForecastCard } from "@/components/objective/ForecastCard";

describe("ForecastCard", () => {
  it("renders the forecasted values", () => {
    render(
      <ForecastCard
        data={{
          forecastedHotLeads: 51,
          forecastedSpend: 28_000_000,
          probability: 0.8,
          onTrackStatus: "ON_TRACK",
        }}
      />,
    );
    expect(screen.getByText(/51 hot leads/)).toBeInTheDocument();
    expect(screen.getByText(/80% probabilitas tercapai/)).toBeInTheDocument();
  });

  it("shows a danger badge for OFF_TRACK", () => {
    render(
      <ForecastCard
        data={{
          forecastedHotLeads: 20,
          forecastedSpend: 10_000_000,
          probability: 0.2,
          onTrackStatus: "OFF_TRACK",
        }}
      />,
    );
    expect(screen.getByText("OFF TRACK")).toHaveClass("text-brand-danger");
  });
});
