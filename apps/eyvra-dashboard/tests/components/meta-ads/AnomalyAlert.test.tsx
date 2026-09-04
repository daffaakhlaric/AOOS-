import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnomalyAlert } from "@/components/meta-ads/AnomalyAlert";
import type { AnomalySignalsDto } from "@/types/dashboard.types";

describe("AnomalyAlert", () => {
  it("renders nothing when there are zero anomalies — an all-clear state isn't an alert", () => {
    const anomalies: AnomalySignalsDto = {
      available: true,
      anomalies: [],
      reasoning: "Tidak ada anomali frequency terdeteksi.",
    };
    const { container } = render(<AnomalyAlert anomalies={anomalies} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders every real detected FREQUENCY_HIGH anomaly with its severity and message", () => {
    const anomalies: AnomalySignalsDto = {
      available: true,
      anomalies: [
        {
          adId: "ad-1",
          adName: "Xpander Cinere",
          anomalyType: "FREQUENCY_HIGH",
          severity: "HIGH",
          frequency: 5.5,
          message: "Frequency 5.5x — iklan mulai jenuh. Pertimbangkan ganti creative.",
        },
        {
          adId: "ad-2",
          adName: "Brio Bintaro",
          anomalyType: "FREQUENCY_HIGH",
          severity: "MEDIUM",
          frequency: 3.8,
          message: "Frequency 3.8x — iklan mulai jenuh. Pertimbangkan ganti creative.",
        },
      ],
      reasoning: "2 iklan dengan frequency tinggi (creative fatigue) terdeteksi.",
    };
    render(<AnomalyAlert anomalies={anomalies} />);
    const alert = screen.getByTestId("anomaly-alert");
    expect(alert.textContent).toContain("Xpander Cinere");
    expect(alert.textContent).toContain("Brio Bintaro");
    expect(alert.textContent).toContain("5.5x");
    expect(alert.textContent).toContain("2 Anomali Terdeteksi");
  });

  it("never renders a non-FREQUENCY_HIGH anomaly type — only what the real detector computes", () => {
    const anomalies: AnomalySignalsDto = {
      available: true,
      anomalies: [
        {
          adId: "ad-1",
          adName: "Xpander Cinere",
          anomalyType: "FREQUENCY_HIGH",
          severity: "HIGH",
          frequency: 5.5,
          message: "Frequency 5.5x — iklan mulai jenuh. Pertimbangkan ganti creative.",
        },
      ],
      reasoning: "1 iklan dengan frequency tinggi (creative fatigue) terdeteksi.",
    };
    render(<AnomalyAlert anomalies={anomalies} />);
    const alert = screen.getByTestId("anomaly-alert");
    expect(alert.textContent).not.toContain("SPEND_DROP");
    expect(alert.textContent).not.toContain("CPL_INCREASE");
  });
});
