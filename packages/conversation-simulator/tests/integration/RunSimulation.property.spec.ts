import { describe, expect, it } from "vitest";

import { PersonaId } from "../../src/domain/value-objects/PersonaId.js";
import { SimulationStatus } from "../../src/domain/value-objects/SimulationStatus.js";
import { SimulatorFactory } from "../../src/factories/SimulatorFactory.js";
import { makeSimulatorConfig } from "../fixtures/simulatorFixtures.js";
import { unwrap } from "../helpers/result.js";

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 (spec section 12 point 3) — drives the REAL
 * `@aos/sales-agent` PROPERTY-vertical `JessyAgent` (`JessyAgentFactory.createPropertyAgent`)
 * end-to-end through the public `SimulatorFactory`/`RunSimulation` surface, entirely in-memory.
 * Every existing persona script is written in automotive vocabulary ("Avanza", "kredit syariah",
 * etc.) that PROPERTY's own intent/scoring vocabulary doesn't recognize, so this deliberately does
 * NOT assert the same HOT/handoff outcomes `RunSimulation.spec.ts` asserts for the automotive path
 * — it proves the PROPERTY composition wiring itself (union `agent` type,
 * `PropertyProcessIncomingMessage`, `FollowUpService` reuse, `ListingQueryServiceSpy`) runs for
 * real without error and produces a well-formed `SimulationResult`.
 */
describe("Integration: RunSimulation (vertical: PROPERTY)", () => {
  it("runs a full PROPERTY-vertical simulation session end-to-end with no real listings configured", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(
        PersonaId.COLD_BUYER,
        makeSimulatorConfig({ vertical: "PROPERTY" }),
      ),
    );

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.status).not.toBe(SimulationStatus.FAILED);
    expect(result.jessyUsedInventory).toBe(false);
  });

  it("runs a full PROPERTY-vertical simulation session with real listing data wired through SimulatorConfig.listings", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const result = unwrap(
      await simulator.runSimulation.execute(
        PersonaId.READY_BUYER,
        makeSimulatorConfig({
          vertical: "PROPERTY",
          listingId: "listing-1",
          listings: [
            {
              id: "listing-1",
              title: "Rumah Minimalis Cinere",
              propertyType: "RUMAH",
              price: 1_500_000_000,
              city: "Cinere",
              bedrooms: 3,
              bathrooms: 2,
            },
          ],
        }),
      ),
    );

    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.status).not.toBe(SimulationStatus.FAILED);
  });
});
