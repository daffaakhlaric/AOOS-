import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeedbackPanel } from "@/components/simulator/FeedbackPanel";

import { buildJudgementResult } from "../fixtures";

describe("FeedbackPanel", () => {
  it("renders nothing when there is no judgement result", () => {
    const { container } = render(<FeedbackPanel judgementResult={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders highlights under "Yang bagus"', () => {
    render(
      <FeedbackPanel
        judgementResult={buildJudgementResult({
          highlights: ["Berhasil qualify semua 4 kriteria dalam 4 turn"],
        })}
      />,
    );
    expect(screen.getByText("✅ Yang bagus:")).toBeInTheDocument();
    expect(screen.getByText("Berhasil qualify semua 4 kriteria dalam 4 turn")).toBeInTheDocument();
  });

  it('renders feedback items under "Yang perlu diperbaiki"', () => {
    render(
      <FeedbackPanel
        judgementResult={buildJudgementResult({
          feedbackItems: [
            { dimension: "RESPONSE_LENGTH", message: "Pesan ke-3 agak panjang (187 karakter)" },
          ],
        })}
      />,
    );
    expect(screen.getByText("⚠️ Yang perlu diperbaiki:")).toBeInTheDocument();
    expect(screen.getByText("Pesan ke-3 agak panjang (187 karakter)")).toBeInTheDocument();
  });

  it("renders nothing when both highlights and feedbackItems are empty", () => {
    const { container } = render(
      <FeedbackPanel
        judgementResult={buildJudgementResult({ highlights: [], feedbackItems: [] })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
