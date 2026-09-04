import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapiHealthCard } from "@/components/meta-ads/CapiHealthCard";
import type { CapiHealthSignalDto } from "@/types/dashboard.types";

describe("CapiHealthCard", () => {
  it("renders the real score/eventsReceived/pixelId when available", () => {
    const capiHealth: CapiHealthSignalDto = {
      available: true,
      pixelId: "pixel-123",
      score: 7.2,
      eventsReceived: 12,
      capturedAt: "2026-08-24T05:00:00.000Z",
      reasoning: "CAPI Event Match Quality score 7.2/10, 12 event diterima.",
    };
    render(<CapiHealthCard capiHealth={capiHealth} />);
    const card = screen.getByTestId("capi-health-card");
    expect(card.textContent).toContain("7.2/10");
    expect(card.textContent).toContain("12");
    expect(card.textContent).toContain("pixel-123");
  });

  it("never renders a fabricated per-event-type table or issues list — EmqReport has no such fields", () => {
    const capiHealth: CapiHealthSignalDto = {
      available: true,
      pixelId: "pixel-123",
      score: 7.2,
      eventsReceived: 12,
      capturedAt: "2026-08-24T05:00:00.000Z",
      reasoning: "CAPI Event Match Quality score 7.2/10, 12 event diterima.",
    };
    render(<CapiHealthCard capiHealth={capiHealth} />);
    const card = screen.getByTestId("capi-health-card");
    expect(card.textContent).not.toContain("Lead");
    expect(card.textContent).not.toContain("Contact");
    expect(card.textContent).not.toContain("Purchase");
  });

  it("renders the honest unavailable reasoning when CAPI isn't configured, never a fabricated score", () => {
    const capiHealth: CapiHealthSignalDto = {
      available: false,
      reasoning: "CAPI_PIXEL_ID/CAPI_ACCESS_TOKEN belum dikonfigurasi.",
    };
    render(<CapiHealthCard capiHealth={capiHealth} />);
    const card = screen.getByTestId("capi-health-card");
    expect(card.textContent).toContain("belum dikonfigurasi");
    expect(card.textContent).not.toMatch(/\d\/10/);
  });
});
