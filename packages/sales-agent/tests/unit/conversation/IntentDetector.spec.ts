import { describe, expect, it } from "vitest";

import { DetectedIntent, IntentDetector } from "../../../src/conversation/IntentDetector.js";

describe("IntentDetector", () => {
  it('"ada Xpander gak?" → ASK_UNIT + ASK_STOCK', () => {
    const intents = IntentDetector.detect("ada Xpander gak?");
    expect(intents).toEqual(
      expect.arrayContaining([DetectedIntent.ASK_UNIT, DetectedIntent.ASK_STOCK]),
    );
  });

  it('"dp berapa?" → ASK_PRICE', () => {
    expect(IntentDetector.detect("dp berapa?")).toContain(DetectedIntent.ASK_PRICE);
  });

  it('"halo min" → GREETING', () => {
    expect(IntentDetector.detect("halo min")).toContain(DetectedIntent.GREETING);
  });

  it('"pikir dulu ya" → HESITATION', () => {
    expect(IntentDetector.detect("pikir dulu ya")).toContain(DetectedIntent.HESITATION);
  });

  it('"oke siap" → AFFIRMATIVE', () => {
    expect(IntentDetector.detect("oke siap")).toContain(DetectedIntent.AFFIRMATIVE);
  });

  it('"200 juta" → BUDGET', () => {
    expect(IntentDetector.detect("budget saya 200 juta")).toContain(DetectedIntent.BUDGET);
  });

  it('"cash aja" → CASH', () => {
    expect(IntentDetector.detect("cash aja kak")).toContain(DetectedIntent.CASH);
  });

  it('"mau kredit" → KREDIT', () => {
    expect(IntentDetector.detect("mau kredit")).toContain(DetectedIntent.KREDIT);
  });

  it('"ada syariah?" → SYARIAH', () => {
    expect(IntentDetector.detect("ada syariah gak?")).toContain(DetectedIntent.SYARIAH);
  });

  it('"dimana lokasinya" → ASK_LOCATION', () => {
    expect(IntentDetector.detect("dimana lokasinya kak?")).toContain(DetectedIntent.ASK_LOCATION);
  });

  it('"mau banget" → INTEREST', () => {
    expect(IntentDetector.detect("saya mau banget")).toContain(DetectedIntent.INTEREST);
  });

  it("a message matching nothing returns an empty array", () => {
    expect(IntentDetector.detect("zzz")).toEqual([]);
  });

  it("has() checks a single intent without needing the full detect() array", () => {
    expect(IntentDetector.has("halo kak", DetectedIntent.GREETING)).toBe(true);
    expect(IntentDetector.has("halo kak", DetectedIntent.ASK_PRICE)).toBe(false);
  });
});
