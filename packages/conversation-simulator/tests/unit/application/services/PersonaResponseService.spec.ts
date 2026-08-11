import { describe, expect, it } from "vitest";

import { PersonaResponseService } from "../../../../src/application/services/PersonaResponseService.js";
import { ColdBuyer } from "../../../../src/personas/ColdBuyer.js";
import { PersonaRegistry } from "../../../../src/registry/PersonaRegistry.js";
import { unwrap } from "../../../helpers/result.js";

describe("PersonaResponseService", () => {
  const strategy = new PersonaResponseService();

  it("returns script lines in order as turnsSoFar advances", () => {
    expect(strategy.nextMessage(ColdBuyer, 0)).toBe("halo min");
    expect(strategy.nextMessage(ColdBuyer, 1)).toBe("lagi cari mobil");
    expect(strategy.nextMessage(ColdBuyer, 2)).toBe("masih lihat-lihat dulu");
    expect(strategy.nextMessage(ColdBuyer, 3)).toBe("oke nanti kabarin deh");
  });

  it("returns undefined once the script is exhausted", () => {
    expect(strategy.nextMessage(ColdBuyer, 4)).toBeUndefined();
    expect(strategy.nextMessage(ColdBuyer, 100)).toBeUndefined();
  });

  it("returns undefined for a negative index", () => {
    expect(strategy.nextMessage(ColdBuyer, -1)).toBeUndefined();
  });

  it("never loops back to the start once exhausted", () => {
    const results = [4, 5, 6].map((n) => strategy.nextMessage(ColdBuyer, n));
    expect(results.every((r) => r === undefined)).toBe(true);
  });

  it("for every registered persona, consuming its script length in order yields exactly script.length real messages then undefined", () => {
    const registry = unwrap(PersonaRegistry.create());
    for (const persona of registry.list()) {
      const consumed: string[] = [];
      let turn = 0;
      let next = strategy.nextMessage(persona, turn);
      while (next !== undefined) {
        consumed.push(next);
        turn += 1;
        next = strategy.nextMessage(persona, turn);
      }
      expect(consumed).toEqual(persona.script);
    }
  });
});
