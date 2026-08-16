import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ObjectiveProgress } from "@/components/dashboard/ObjectiveProgress";

describe("ObjectiveProgress", () => {
  it("progress bar width is proportional to the percentage", () => {
    render(
      <ObjectiveProgress
        data={{ targetHotLeads: 50, currentHotLeads: 47, onTrackStatus: "ON_TRACK" }}
      />,
    );
    expect(screen.getByTestId("objective-progress-bar")).toHaveStyle({ width: "94%" });
  });

  it("ON_TRACK renders a green badge", () => {
    render(
      <ObjectiveProgress
        data={{ targetHotLeads: 50, currentHotLeads: 47, onTrackStatus: "ON_TRACK" }}
      />,
    );
    expect(screen.getByText("ON TRACK")).toHaveAttribute("data-tone", "success");
  });

  it("OFF_TRACK renders a red badge", () => {
    render(
      <ObjectiveProgress
        data={{ targetHotLeads: 50, currentHotLeads: 10, onTrackStatus: "OFF_TRACK" }}
      />,
    );
    expect(screen.getByText("OFF TRACK")).toHaveAttribute("data-tone", "danger");
  });

  it("AT_RISK renders an amber badge", () => {
    render(
      <ObjectiveProgress
        data={{ targetHotLeads: 50, currentHotLeads: 30, onTrackStatus: "AT_RISK" }}
      />,
    );
    expect(screen.getByText("AT RISK")).toHaveAttribute("data-tone", "warning");
  });

  it("shows the forecast line when forecastedHotLeads is provided", () => {
    render(
      <ObjectiveProgress
        data={{
          targetHotLeads: 50,
          currentHotLeads: 47,
          onTrackStatus: "ON_TRACK",
          forecastedHotLeads: 51,
        }}
      />,
    );
    expect(screen.getByText(/Proyeksi akhir bulan: 51 leads/)).toBeInTheDocument();
  });

  it("caps the progress bar at 100% when current exceeds target", () => {
    render(
      <ObjectiveProgress
        data={{ targetHotLeads: 50, currentHotLeads: 60, onTrackStatus: "ON_TRACK" }}
      />,
    );
    expect(screen.getByTestId("objective-progress-bar")).toHaveStyle({ width: "100%" });
  });
});
