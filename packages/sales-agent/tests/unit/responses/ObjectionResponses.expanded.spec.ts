import { describe, expect, it } from "vitest";

import { DetectedIntent } from "../../../src/conversation/IntentDetector.js";
import {
  getObjectionResponse,
  OBJECTION_NOT_SURE,
  PRICE_OBJECTION_POOL,
  QUALITY_OBJECTION_POOL,
} from "../../../src/responses/ObjectionResponses.js";

/** AAOS-W3A-S1 Fix 3: new QUALITY_OBJECTION_POOL / PRICE_OBJECTION_POOL, wired to the broadened HESITATION patterns + new COMPLAINT intent from Fix 2. */
describe("ObjectionResponses (AAOS-W3A-S1 expanded pools)", () => {
  it("QUALITY_OBJECTION_POOL: every entry mentions '150' and/or 'Otospector', stays ≤ 300 chars", () => {
    expect(QUALITY_OBJECTION_POOL.length).toBeGreaterThan(0);
    for (const entry of QUALITY_OBJECTION_POOL) {
      expect(entry.includes("150") || entry.includes("Otospector")).toBe(true);
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });

  it("PRICE_OBJECTION_POOL: every entry stays ≤ 300 chars", () => {
    expect(PRICE_OBJECTION_POOL.length).toBeGreaterThan(0);
    for (const entry of PRICE_OBJECTION_POOL) {
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });

  it("COMPLAINT intent → QUALITY_OBJECTION_POOL, includes 'Otospector'", () => {
    const text = getObjectionResponse("kemarin temen beli mobil bekas rusak terus", 0, [
      DetectedIntent.COMPLAINT,
    ]);
    expect(QUALITY_OBJECTION_POOL).toContain(text);
    expect(text).toContain("Otospector");
  });

  it("quality-doubt phrasing (no intents passed) → QUALITY_OBJECTION_POOL", () => {
    const text = getObjectionResponse("mobilnya beneran bagus gak sih?", 0);
    expect(QUALITY_OBJECTION_POOL).toContain(text);
  });

  it("'ada masalah' quality doubt → QUALITY_OBJECTION_POOL", () => {
    const text = getObjectionResponse("ada masalah gak sih unitnya", 0);
    expect(QUALITY_OBJECTION_POOL).toContain(text);
  });

  it("comparison-shopping phrasing → PRICE_OBJECTION_POOL", () => {
    const text = getObjectionResponse("di tempat lain lebih murah kayaknya", 0);
    expect(PRICE_OBJECTION_POOL).toContain(text);
  });

  it("'dealer lain' comparison → PRICE_OBJECTION_POOL", () => {
    const text = getObjectionResponse("dealer lain kasih harga beda", 0);
    expect(PRICE_OBJECTION_POOL).toContain(text);
  });

  it("plain 'mahal' still routes through the pre-existing JessyKnowledgeBase handler, NOT PRICE_OBJECTION_POOL (no regression)", () => {
    const text = getObjectionResponse("kayaknya mahal ya", 0);
    expect(text).toContain("transparan");
    expect(PRICE_OBJECTION_POOL).not.toContain(text);
  });

  it("existing known-objection handlers still take priority over the new pools", () => {
    expect(getObjectionResponse("saya takut bermasalah nih", 0)).toContain("Otospector");
    expect(getObjectionResponse("pikir dulu ya kak", 0)).toContain("reserve");
    expect(getObjectionResponse("takut kredit ditolak", 0)).toContain("leasing");
  });

  it("an unknown, non-quality, non-comparison objection still falls back to OBJECTION_NOT_SURE", () => {
    const text = getObjectionResponse("hmm ok deh", 0);
    expect(OBJECTION_NOT_SURE).toContain(text);
  });

  it("intents defaulting to [] keeps the original 2-arg call shape working", () => {
    const text = getObjectionResponse("hmm ok deh", 0);
    expect(typeof text).toBe("string");
  });
});
