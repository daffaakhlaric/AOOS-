import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SimulatorPage from "@/app/simulator/page";

/**
 * Renders the real Server Component directly (it's a synchronous function, no `use`/streaming
 * needed) — exercises the real `getSimulator()` -> `listPersonas.execute()` path from
 * `src/lib/simulator.ts`, never a mock, so this is the same "all 10 persona names render" check
 * the manual dev-server verification also performs, just under Vitest/jsdom instead of curl.
 *
 * `SimulatorClient`'s new `TenantVerticalSelector` (this task) fires a real
 * `fetch("/api/tenants")` on mount — stubbed here to a never-network-touching mock, same reasoning
 * as `report-page.test.tsx`'s own `/api/simulate-all` stub.
 */
describe("SimulatorPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: false, reason: "not configured in this test" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the page heading", async () => {
    render(<SimulatorPage />);
    expect(screen.getByText("🎮 Clara Simulator")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("tenant-selector-error")).toBeInTheDocument());
  });

  it("renders all 10 real persona names from the real PersonaRegistry", async () => {
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
    await waitFor(() => expect(screen.getByTestId("tenant-selector-error")).toBeInTheDocument());
  });

  it('links "Run All Scenarios →" to /report', async () => {
    render(<SimulatorPage />);
    expect(screen.getByText("Run All Scenarios →").closest("a")).toHaveAttribute("href", "/report");
    await waitFor(() => expect(screen.getByTestId("tenant-selector-error")).toBeInTheDocument());
  });
});
