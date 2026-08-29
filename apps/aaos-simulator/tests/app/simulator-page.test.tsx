import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SimulatorPage from "@/app/simulator/page";

/**
 * Renders the real Server Component directly (it's a synchronous function, no `use`/streaming
 * needed) — exercises the real `getSimulator()` -> `listPersonas.execute()` path from
 * `src/lib/simulator.ts`, never a mock, so this is the same "all 10 persona names render" check
 * the manual dev-server verification also performs, just under Vitest/jsdom instead of curl.
 */
describe("SimulatorPage", () => {
  it("renders the page heading", () => {
    render(<SimulatorPage />);
    expect(screen.getByText("🎮 Clara Simulator")).toBeInTheDocument();
  });

  it("renders all 10 real persona names from the real PersonaRegistry", () => {
    render(<SimulatorPage />);
    for (const name of [
      "Cold Buyer",
      "Budget Buyer",
      "Ready Buyer",
      "Specific Unit Buyer",
      "Kredit Buyer",
      "Syariah Buyer",
      "Ghost Buyer",
      "Complainer Buyer",
      "First Time Buyer",
      "Urgent Buyer",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('links "Run All Scenarios →" to /report', () => {
    render(<SimulatorPage />);
    expect(screen.getByText("Run All Scenarios →").closest("a")).toHaveAttribute("href", "/report");
  });
});
