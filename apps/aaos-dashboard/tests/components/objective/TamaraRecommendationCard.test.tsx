import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TamaraRecommendationCard } from "@/components/objective/TamaraRecommendationCard";

describe("TamaraRecommendationCard", () => {
  it("renders the recommendation actions list", () => {
    render(
      <TamaraRecommendationCard
        data={{
          summary: "Berdasarkan data Juli...",
          actions: ["Scale #C047", "Pause 16 iklan boros"],
        }}
      />,
    );
    expect(screen.getByText("Scale #C047")).toBeInTheDocument();
    expect(screen.getByText("Pause 16 iklan boros")).toBeInTheDocument();
  });

  it('"Pakai Rekomendasi" button is clickable', async () => {
    const onUseRecommendation = vi.fn();
    render(
      <TamaraRecommendationCard
        data={{ summary: "Ringkasan", actions: [] }}
        onUseRecommendation={onUseRecommendation}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Pakai Rekomendasi Ini" }));
    expect(onUseRecommendation).toHaveBeenCalledOnce();
  });
});
