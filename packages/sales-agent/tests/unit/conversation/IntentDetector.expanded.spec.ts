import { describe, expect, it } from "vitest";

import { DetectedIntent, IntentDetector } from "../../../src/conversation/IntentDetector.js";

/**
 * AAOS-W3A-S1 Fix 2: broadened HESITATION detection + new COMPLAINT intent. Real buyer skeptical
 * phrasing that the original 5-pattern HESITATION list missed (spec "Background" gap #2).
 */
describe("IntentDetector (AAOS-W3A-S1 expanded HESITATION/COMPLAINT)", () => {
  describe("regression: the original 5 literal HESITATION phrases still detect", () => {
    it('"pikir dulu ya" → HESITATION', () => {
      expect(IntentDetector.detect("pikir dulu ya")).toContain(DetectedIntent.HESITATION);
    });

    it('"nanti deh kalau udah siap" → HESITATION', () => {
      expect(IntentDetector.detect("nanti deh kalau udah siap")).toContain(
        DetectedIntent.HESITATION,
      );
    });

    it('"belum tau mau yang mana" → HESITATION', () => {
      expect(IntentDetector.detect("belum tau mau yang mana")).toContain(DetectedIntent.HESITATION);
    });

    it('"cuma tanya-tanya aja kak" → HESITATION', () => {
      expect(IntentDetector.detect("cuma tanya-tanya aja kak")).toContain(
        DetectedIntent.HESITATION,
      );
    });

    it('"masih lihat-lihat dulu" → HESITATION', () => {
      expect(IntentDetector.detect("masih lihat-lihat dulu")).toContain(DetectedIntent.HESITATION);
    });
  });

  describe("new: quality-doubt phrasing → HESITATION", () => {
    it('"mobilnya beneran bagus gak sih?" → HESITATION', () => {
      expect(IntentDetector.detect("mobilnya beneran bagus gak sih?")).toContain(
        DetectedIntent.HESITATION,
      );
    });

    it('"unitnya aman gak sih?" → HESITATION', () => {
      expect(IntentDetector.detect("unitnya aman gak sih?")).toContain(DetectedIntent.HESITATION);
    });

    it('"takut bermasalah" → HESITATION', () => {
      expect(IntentDetector.detect("takut bermasalah")).toContain(DetectedIntent.HESITATION);
    });

    it('"ada masalah gak ya" → HESITATION', () => {
      expect(IntentDetector.detect("ada masalah gak ya")).toContain(DetectedIntent.HESITATION);
    });

    it('"takut cacat" → HESITATION', () => {
      expect(IntentDetector.detect("takut cacat")).toContain(DetectedIntent.HESITATION);
    });
  });

  describe("new: trust-concern phrasing → HESITATION", () => {
    it('"agak khawatir nih" → HESITATION', () => {
      expect(IntentDetector.detect("agak khawatir nih")).toContain(DetectedIntent.HESITATION);
    });

    it('"masih ragu nih kak" → HESITATION', () => {
      expect(IntentDetector.detect("masih ragu nih kak")).toContain(DetectedIntent.HESITATION);
    });

    it('"gak yakin deh" → HESITATION', () => {
      expect(IntentDetector.detect("gak yakin deh")).toContain(DetectedIntent.HESITATION);
    });
  });

  describe("new: price-objection phrasing → HESITATION", () => {
    it('"mahal" → HESITATION', () => {
      expect(IntentDetector.detect("kayaknya mahal ya")).toContain(DetectedIntent.HESITATION);
    });

    it('"kemahalan" → HESITATION', () => {
      expect(IntentDetector.detect("kemahalan sih ini")).toContain(DetectedIntent.HESITATION);
    });
  });

  describe("new: comparison-shopping phrasing → HESITATION", () => {
    it('"di tempat lain lebih murah" → HESITATION', () => {
      expect(IntentDetector.detect("di tempat lain lebih murah")).toContain(
        DetectedIntent.HESITATION,
      );
    });

    it('"dealer lain kasih harga beda" → HESITATION', () => {
      expect(IntentDetector.detect("dealer lain kasih harga beda")).toContain(
        DetectedIntent.HESITATION,
      );
    });
  });

  describe("new: cancel/backing-out phrasing → HESITATION", () => {
    it('"gak jadi deh kayaknya" → HESITATION', () => {
      expect(IntentDetector.detect("gak jadi deh kayaknya")).toContain(DetectedIntent.HESITATION);
    });

    it('"batal aja deh" → HESITATION', () => {
      expect(IntentDetector.detect("batal aja deh")).toContain(DetectedIntent.HESITATION);
    });
  });

  describe("new: COMPLAINT intent", () => {
    it('"teman beli rusak" → COMPLAINT', () => {
      expect(IntentDetector.detect("teman beli rusak")).toContain(DetectedIntent.COMPLAINT);
    });

    it('"temen beli mobil bekas rusak" (colloquial spelling) → COMPLAINT', () => {
      expect(IntentDetector.detect("kemarin temen beli mobil bekas rusak terus")).toContain(
        DetectedIntent.COMPLAINT,
      );
    });

    it('"pengalaman buruk sama dealer sebelumnya" → COMPLAINT', () => {
      expect(IntentDetector.detect("pengalaman buruk sama dealer sebelumnya")).toContain(
        DetectedIntent.COMPLAINT,
      );
    });

    it('"kecewa banget waktu itu" → COMPLAINT', () => {
      expect(IntentDetector.detect("kecewa banget waktu itu")).toContain(DetectedIntent.COMPLAINT);
    });

    it("a message matching nothing does not carry COMPLAINT", () => {
      expect(IntentDetector.detect("zzz")).not.toContain(DetectedIntent.COMPLAINT);
    });

    it("has() checks COMPLAINT directly", () => {
      expect(IntentDetector.has("kecewa banget", DetectedIntent.COMPLAINT)).toBe(true);
      expect(IntentDetector.has("halo kak", DetectedIntent.COMPLAINT)).toBe(false);
    });
  });

  describe("HESITATION and COMPLAINT can both fire on the same message", () => {
    it('"temen beli rusak" fires both HESITATION (rusak) and COMPLAINT (teman.*rusak)', () => {
      const intents = IntentDetector.detect("kemarin temen beli mobil bekas rusak terus");
      expect(intents).toEqual(
        expect.arrayContaining([DetectedIntent.HESITATION, DetectedIntent.COMPLAINT]),
      );
    });
  });
});
