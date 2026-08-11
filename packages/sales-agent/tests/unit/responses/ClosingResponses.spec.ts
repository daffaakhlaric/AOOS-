import { describe, expect, it } from "vitest";

import {
  CLOSING_FOLLOW_POOL,
  CLOSING_HOT_POOL,
  CLOSING_WARM_POOL,
  getClosingResponse,
} from "../../../src/responses/ClosingResponses.js";

const CLOSING_INTENT_PATTERN = /test\s*drive|survei|survey|jadwal/i;
const ABRUPT_CLOSING_PATTERN = /Apakah Anda tertarik/i;

describe("ClosingResponses (AAOS-W3D Fix 1)", () => {
  describe("CLOSING_WARM_POOL", () => {
    it("has at least one entry", () => {
      expect(CLOSING_WARM_POOL.length).toBeGreaterThan(0);
    });

    it("every entry is ≤ 150 chars", () => {
      for (const entry of CLOSING_WARM_POOL) {
        expect(entry.length).toBeLessThanOrEqual(150);
      }
    });

    it("every entry mentions test drive/survey/jadwal", () => {
      for (const entry of CLOSING_WARM_POOL) {
        expect(CLOSING_INTENT_PATTERN.test(entry)).toBe(true);
      }
    });

    it("every entry avoids the abrupt closing pattern", () => {
      for (const entry of CLOSING_WARM_POOL) {
        expect(ABRUPT_CLOSING_PATTERN.test(entry)).toBe(false);
      }
    });

    it("every entry is longer than 15 chars (CLOSING_IS_NATURAL floor)", () => {
      for (const entry of CLOSING_WARM_POOL) {
        expect(entry.length).toBeGreaterThan(15);
      }
    });
  });

  describe("CLOSING_HOT_POOL", () => {
    it("has at least one entry", () => {
      expect(CLOSING_HOT_POOL.length).toBeGreaterThan(0);
    });

    it("every entry is ≤ 150 chars", () => {
      for (const entry of CLOSING_HOT_POOL) {
        expect(entry.length).toBeLessThanOrEqual(150);
      }
    });

    it("every entry mentions test drive/survey/jadwal", () => {
      for (const entry of CLOSING_HOT_POOL) {
        expect(CLOSING_INTENT_PATTERN.test(entry)).toBe(true);
      }
    });
  });

  describe("CLOSING_FOLLOW_POOL", () => {
    it("has at least one entry", () => {
      expect(CLOSING_FOLLOW_POOL.length).toBeGreaterThan(0);
    });

    it("every entry is ≤ 150 chars", () => {
      for (const entry of CLOSING_FOLLOW_POOL) {
        expect(entry.length).toBeLessThanOrEqual(150);
      }
    });

    it("every entry mentions test drive/survey/jadwal", () => {
      for (const entry of CLOSING_FOLLOW_POOL) {
        expect(CLOSING_INTENT_PATTERN.test(entry)).toBe(true);
      }
    });
  });

  describe("getClosingResponse", () => {
    it("score >= hotThreshold → always picks from CLOSING_HOT_POOL, regardless of attempt count", () => {
      const text = getClosingResponse(70, 0, 65, 0);
      expect(CLOSING_HOT_POOL).toContain(text);
    });

    it("score >= hotThreshold with a nonzero attempt count still picks CLOSING_HOT_POOL", () => {
      const text = getClosingResponse(80, 3, 65, 1);
      expect(CLOSING_HOT_POOL).toContain(text);
    });

    it("WARM score, first attempt (count 0) → CLOSING_WARM_POOL", () => {
      const text = getClosingResponse(50, 0, 65, 0);
      expect(CLOSING_WARM_POOL).toContain(text);
    });

    it("WARM score, second+ attempt (count >= 1) → CLOSING_FOLLOW_POOL", () => {
      const text = getClosingResponse(50, 1, 65, 0);
      expect(CLOSING_FOLLOW_POOL).toContain(text);
    });

    it("WARM score, count 2 → still CLOSING_FOLLOW_POOL", () => {
      const text = getClosingResponse(55, 2, 65, 0);
      expect(CLOSING_FOLLOW_POOL).toContain(text);
    });

    it("is deterministic for a given seed", () => {
      const first = getClosingResponse(50, 0, 65, 4);
      const second = getClosingResponse(50, 0, 65, 4);
      expect(first).toBe(second);
    });

    it("varies with seed across the WARM pool", () => {
      const seenIndexes = new Set<string>();
      for (let seed = 0; seed < CLOSING_WARM_POOL.length; seed += 1) {
        seenIndexes.add(getClosingResponse(50, 0, 65, seed));
      }
      expect(seenIndexes.size).toBeGreaterThan(1);
    });
  });
});
