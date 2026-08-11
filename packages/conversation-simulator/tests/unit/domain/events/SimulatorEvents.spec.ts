import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";
import { SimulatorEvents } from "../../../../src/domain/events/SimulatorEvents.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");
const BASE = {
  tenantId: "tenant-x",
  correlationId: "corr-1",
  occurredAt: NOW,
  version: "1.0" as const,
};

describe("SimulatorEvents", () => {
  it("publishSimulationStarted() publishes with the correct type/category/producer", async () => {
    const publisher = new ObservablePublisher();
    const events = new SimulatorEvents(publisher);
    await events.publishSimulationStarted({
      ...BASE,
      sessionId: "s1",
      personaId: "cold_buyer",
      branchId: "CINERE",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.simulator.simulation.started");
    expect(publisher.published[0]?.category).toBe(EventCategory.DOMAIN);
    expect(publisher.published[0]?.producer).toBe("@aos/conversation-simulator");
  });

  it("publishTurnCompleted() publishes with the correct type", async () => {
    const publisher = new ObservablePublisher();
    const events = new SimulatorEvents(publisher);
    await events.publishTurnCompleted({
      ...BASE,
      sessionId: "s1",
      personaId: "cold_buyer",
      turn: 1,
      score: 25,
    });
    expect(publisher.published[0]?.type).toBe("aaos.simulator.turn.completed");
  });

  it("publishHandoffReached() publishes with the correct type", async () => {
    const publisher = new ObservablePublisher();
    const events = new SimulatorEvents(publisher);
    await events.publishHandoffReached({
      ...BASE,
      sessionId: "s1",
      personaId: "ready_buyer",
      turn: 3,
      score: 80,
    });
    expect(publisher.published[0]?.type).toBe("aaos.simulator.handoff.reached");
  });

  it("publishSimulationCompleted() publishes with the correct type", async () => {
    const publisher = new ObservablePublisher();
    const events = new SimulatorEvents(publisher);
    await events.publishSimulationCompleted({
      ...BASE,
      sessionId: "s1",
      personaId: "cold_buyer",
      status: "COMPLETED",
      totalTurns: 4,
      finalScore: 0,
      finalTemperature: "COLD",
      metExpectation: true,
    });
    expect(publisher.published[0]?.type).toBe("aaos.simulator.simulation.completed");
  });

  it("publishSimulationFailed() publishes with the correct type", async () => {
    const publisher = new ObservablePublisher();
    const events = new SimulatorEvents(publisher);
    await events.publishSimulationFailed({
      ...BASE,
      sessionId: "s1",
      personaId: "cold_buyer",
      turn: 2,
      reason: "boom",
    });
    expect(publisher.published[0]?.type).toBe("aaos.simulator.simulation.failed");
  });

  it("defaults source to @aos/conversation-simulator when not overridden", async () => {
    const publisher = new ObservablePublisher();
    const events = new SimulatorEvents(publisher);
    await events.publishSimulationStarted({
      ...BASE,
      sessionId: "s1",
      personaId: "cold_buyer",
      branchId: "CINERE",
    });
    expect(publisher.published[0]?.source).toBe("@aos/conversation-simulator");
  });

  it("accepts a custom source override", async () => {
    const publisher = new ObservablePublisher();
    const events = new SimulatorEvents(publisher, "custom-source");
    await events.publishSimulationStarted({
      ...BASE,
      sessionId: "s1",
      personaId: "cold_buyer",
      branchId: "CINERE",
    });
    expect(publisher.published[0]?.source).toBe("custom-source");
  });
});
