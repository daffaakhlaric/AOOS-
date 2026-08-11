import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PersonaSelector } from "@/components/simulator/PersonaSelector";

import { TEST_PERSONAS } from "../fixtures";

describe("PersonaSelector", () => {
  it("renders all 10 persona cards", () => {
    render(
      <PersonaSelector personas={TEST_PERSONAS} selectedPersonaId={undefined} onSelect={vi.fn()} />,
    );
    expect(screen.getAllByTestId("persona-card")).toHaveLength(10);
  });

  it("renders each persona's real name", () => {
    render(
      <PersonaSelector personas={TEST_PERSONAS} selectedPersonaId={undefined} onSelect={vi.fn()} />,
    );
    for (const persona of TEST_PERSONAS) {
      expect(screen.getByText(persona.name)).toBeInTheDocument();
    }
  });

  it("shows a difficulty badge (EASY/MEDIUM/HARD) for every persona", () => {
    render(
      <PersonaSelector personas={TEST_PERSONAS} selectedPersonaId={undefined} onSelect={vi.fn()} />,
    );
    const badges = screen.getAllByTestId("difficulty-badge");
    expect(badges).toHaveLength(10);
    const labels = badges.map((badge) => badge.textContent);
    expect(labels).toContain("EASY");
    expect(labels).toContain("MEDIUM");
    expect(labels).toContain("HARD");
  });

  it("clicking a persona card calls onSelect with that persona's id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <PersonaSelector
        personas={TEST_PERSONAS}
        selectedPersonaId={undefined}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByText("Ready Buyer"));

    expect(onSelect).toHaveBeenCalledWith("ready_buyer");
  });

  it("marks the currently selected persona as aria-selected", () => {
    render(
      <PersonaSelector
        personas={TEST_PERSONAS}
        selectedPersonaId="ready_buyer"
        onSelect={vi.fn()}
      />,
    );
    const selectedCard = screen.getByText("Ready Buyer").closest('[role="option"]');
    expect(selectedCard).toHaveAttribute("aria-selected", "true");
  });

  it("does not mark unselected personas as selected", () => {
    render(
      <PersonaSelector
        personas={TEST_PERSONAS}
        selectedPersonaId="ready_buyer"
        onSelect={vi.fn()}
      />,
    );
    const unselectedCard = screen.getByText("Cold Buyer").closest('[role="option"]');
    expect(unselectedCard).toHaveAttribute("aria-selected", "false");
  });
});
