import { PersonaId } from "@aos/conversation-simulator";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AllScenariosTable } from "@/components/report/AllScenariosTable";

import { buildSimulateAllResultEntry, TEST_PERSONAS } from "../fixtures";

describe("AllScenariosTable", () => {
  const personaNames = Object.fromEntries(TEST_PERSONAS.map((p) => [p.id, p.name]));

  it("renders one row per result", () => {
    const results = [
      buildSimulateAllResultEntry({ personaId: PersonaId.READY_BUYER }),
      buildSimulateAllResultEntry({ personaId: PersonaId.COLD_BUYER }),
    ];
    render(<AllScenariosTable results={results} personaNames={personaNames} />);
    expect(screen.getAllByTestId("all-scenarios-row")).toHaveLength(2);
  });

  it("shows the persona's real name, not its raw id", () => {
    render(
      <AllScenariosTable
        results={[buildSimulateAllResultEntry({ personaId: PersonaId.READY_BUYER })]}
        personaNames={personaNames}
      />,
    );
    expect(screen.getByText("Ready Buyer")).toBeInTheDocument();
    expect(screen.queryByText("ready_buyer")).not.toBeInTheDocument();
  });

  it("shows the rounded overall score", () => {
    render(
      <AllScenariosTable results={[buildSimulateAllResultEntry()]} personaNames={personaNames} />,
    );
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("shows the grade chip and verdict label", () => {
    render(
      <AllScenariosTable results={[buildSimulateAllResultEntry()]} personaNames={personaNames} />,
    );
    expect(screen.getByTestId("grade-chip")).toHaveTextContent("B+");
    expect(screen.getByText(/APPROVE/)).toBeInTheDocument();
  });
});
