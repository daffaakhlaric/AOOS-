import { describe, expect, it } from "vitest";

import {
  SimulationSpeaker,
  type SimulationMessage,
} from "../../../../src/domain/entities/SimulationMessage.js";

describe("SimulationSpeaker", () => {
  it("has exactly 2 members: BUYER, CLARA", () => {
    expect(Object.values(SimulationSpeaker)).toHaveLength(2);
    expect(SimulationSpeaker.BUYER).toBe("BUYER");
    expect(SimulationSpeaker.CLARA).toBe("CLARA");
  });

  it("a SimulationMessage carries turn, speaker, text, and occurredAt", () => {
    const message: SimulationMessage = {
      turn: 1,
      speaker: SimulationSpeaker.BUYER,
      text: "halo min",
      occurredAt: new Date("2026-08-10T09:00:00.000Z"),
    };
    expect(message.turn).toBe(1);
    expect(message.speaker).toBe(SimulationSpeaker.BUYER);
    expect(message.text).toBe("halo min");
  });

  it("a CLARA-speaker SimulationMessage is structurally identical apart from speaker", () => {
    const at = new Date("2026-08-10T09:00:01.000Z");
    const message: SimulationMessage = {
      turn: 1,
      speaker: SimulationSpeaker.CLARA,
      text: "Halo kak!",
      occurredAt: at,
    };
    expect(message.speaker).toBe(SimulationSpeaker.CLARA);
    expect(message.occurredAt).toBe(at);
  });
});
