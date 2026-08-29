import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConversationView } from "@/components/simulator/ConversationView";

import { buildMessage, buildSimulationResult } from "../fixtures";

describe("ConversationView", () => {
  it('shows "Pilih skenario untuk mulai" when there is no simulation result', () => {
    render(<ConversationView simulationResult={undefined} />);
    expect(screen.getByText("Pilih skenario untuk mulai")).toBeInTheDocument();
    expect(screen.getByTestId("conversation-empty-state")).toBeInTheDocument();
  });

  it("renders buyer messages left-aligned", () => {
    const result = buildSimulationResult({
      messages: [buildMessage({ turn: 1, speaker: "BUYER", text: "halo min" })],
    });
    render(<ConversationView simulationResult={result} />);

    const bubble = screen.getByTestId("message-bubble");
    expect(bubble).toHaveAttribute("data-speaker", "BUYER");
    expect(bubble.className).toContain("justify-start");
  });

  it("renders Clara messages right-aligned in a blue bubble", () => {
    const result = buildSimulationResult({
      messages: [buildMessage({ turn: 1, speaker: "CLARA", text: "halo kak!" })],
    });
    render(<ConversationView simulationResult={result} />);

    const bubble = screen.getByTestId("message-bubble");
    expect(bubble).toHaveAttribute("data-speaker", "CLARA");
    expect(bubble.className).toContain("justify-end");
    expect(bubble.querySelector("div")?.className).toContain("bg-brand-primary");
  });

  it("shows the [HANDOFF TRIGGERED] badge when handoffTriggered is true", () => {
    const result = buildSimulationResult({ handoffTriggered: true });
    render(<ConversationView simulationResult={result} />);
    expect(screen.getByTestId("handoff-badge")).toHaveTextContent("[HANDOFF TRIGGERED]");
  });

  it("does not show the handoff badge when handoffTriggered is false", () => {
    const result = buildSimulationResult({ handoffTriggered: false });
    render(<ConversationView simulationResult={result} />);
    expect(screen.queryByTestId("handoff-badge")).not.toBeInTheDocument();
  });

  it("shows turn count and duration summary", () => {
    const result = buildSimulationResult({ totalTurns: 5, durationMs: 23_000 });
    render(<ConversationView simulationResult={result} />);
    expect(screen.getByText(/5 turns, 23 detik/)).toBeInTheDocument();
  });
});
