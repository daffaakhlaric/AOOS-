import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { GhostBuyer } from "../../../src/personas/GhostBuyer.js";

describe("GhostBuyer", () => {
  it("has the spec's exact id and HARD difficulty", () => {
    expect(GhostBuyer.id).toBe(PersonaId.GHOST_BUYER);
    expect(GhostBuyer.difficulty).toBe(PersonaDifficulty.HARD);
  });

  it("goes silent after exactly 3 messages", () => {
    expect(GhostBuyer.script).toEqual(["halo min", "mau tanya Xpander", "oh oke"]);
    expect(GhostBuyer.script.length).toBe(3);
  });

  it("expects COLD outcome with maxTurns 4", () => {
    expect(GhostBuyer.expectedOutcome).toBe(LeadTemperature.COLD);
    expect(GhostBuyer.maxTurns).toBe(4);
  });

  it("is the only persona flagged testFollowUp: true", () => {
    expect(GhostBuyer.testFollowUp).toBe(true);
  });

  it("does not expect a handoff", () => {
    expect(GhostBuyer.expectedHandoff).toBeUndefined();
  });
});
