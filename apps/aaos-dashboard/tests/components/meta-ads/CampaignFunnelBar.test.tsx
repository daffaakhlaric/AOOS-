import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CampaignFunnelBar } from "@/components/meta-ads/CampaignFunnelBar";

describe("CampaignFunnelBar", () => {
  it("renders every funnel step with its value", () => {
    render(
      <CampaignFunnelBar
        metrics={{
          spend: 0,
          conversations: 790,
          d2: 400,
          d3: 307,
          d5: 100,
          leadForm: 20,
          totalLead: 320,
          rphD3: null,
        }}
      />,
    );
    expect(screen.getByText("790")).toBeInTheDocument();
    expect(screen.getByText("400")).toBeInTheDocument();
    expect(screen.getByText("307")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });
});
