import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InsightBar } from "@/components/overview/InsightBar";

describe("InsightBar", () => {
  it("renders the real generated summary when available", () => {
    render(
      <InsightBar
        insight={{
          available: true,
          summary: "Samantha: CPL turun 8%. Clara: 3 lead HOT.",
          perAgent: { samantha: "CPL turun 8%.", kai: "2 brief pending.", clara: "3 lead HOT." },
        }}
      />,
    );
    expect(screen.getByTestId("insight-bar-available")).toBeInTheDocument();
    expect(screen.getByText("Samantha: CPL turun 8%. Clara: 3 lead HOT.")).toBeInTheDocument();
  });

  it("shows an honest unavailable message (never a fabricated summary) when the LLM insight failed", () => {
    render(
      <InsightBar
        insight={{
          available: false,
          reason: "NO_API_KEY",
          message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
        }}
      />,
    );
    expect(screen.getByTestId("insight-bar-unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/Insight AI tidak tersedia — Aktifkan AI Analysis/),
    ).toBeInTheDocument();
  });
});
