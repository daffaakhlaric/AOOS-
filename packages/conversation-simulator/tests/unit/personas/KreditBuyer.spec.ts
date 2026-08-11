import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { KreditBuyer } from "../../../src/personas/KreditBuyer.js";

describe("KreditBuyer", () => {
  it("has the spec's exact id and difficulty", () => {
    expect(KreditBuyer.id).toBe(PersonaId.KREDIT_BUYER);
    expect(KreditBuyer.difficulty).toBe(PersonaDifficulty.MEDIUM);
  });

  it("has the spec's exact 6-line script", () => {
    expect(KreditBuyer.script).toEqual([
      "halo min mau nanya soal kredit",
      "saya karyawan kontrak bisa kredit gak?",
      "penghasilan 5 juta sebulan",
      "dp berapa yang paling ringan?",
      "prosesnya lama gak?",
      "ok mau coba deh",
    ]);
  });

  it("expects WARM outcome with maxTurns 8", () => {
    expect(KreditBuyer.expectedOutcome).toBe(LeadTemperature.WARM);
    expect(KreditBuyer.maxTurns).toBe(8);
  });

  it("does not expect a handoff or follow-up test phase", () => {
    expect(KreditBuyer.expectedHandoff).toBeUndefined();
    expect(KreditBuyer.testFollowUp).toBeUndefined();
  });
});
