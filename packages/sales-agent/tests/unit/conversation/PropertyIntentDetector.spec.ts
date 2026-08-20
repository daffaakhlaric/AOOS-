import { describe, expect, it } from "vitest";

import {
  ALL_PROPERTY_DETECTED_INTENTS,
  PropertyDetectedIntent,
  PropertyIntentDetector,
} from "../../../src/conversation/PropertyIntentDetector.js";

describe("PropertyIntentDetector", () => {
  it("detects ASK_LISTING for property-type wording (not car models)", () => {
    expect(PropertyIntentDetector.detect("ada rumah di bintaro gak kak?")).toContain(
      PropertyDetectedIntent.ASK_LISTING,
    );
    expect(PropertyIntentDetector.detect("apartemen 2BR dong")).toContain(
      PropertyDetectedIntent.ASK_LISTING,
    );
    expect(PropertyIntentDetector.detect("ruko strategis ada?")).toContain(
      PropertyDetectedIntent.ASK_LISTING,
    );
    expect(PropertyIntentDetector.detect("tanah kavling luas")).toContain(
      PropertyDetectedIntent.ASK_LISTING,
    );
    expect(PropertyIntentDetector.detect("villa view gunung")).toContain(
      PropertyDetectedIntent.ASK_LISTING,
    );
  });

  it("detects ASK_PRICE", () => {
    expect(PropertyIntentDetector.detect("harganya berapa kak?")).toContain(
      PropertyDetectedIntent.ASK_PRICE,
    );
    expect(PropertyIntentDetector.detect("dp nya berapa")).toContain(
      PropertyDetectedIntent.ASK_PRICE,
    );
  });

  it("detects ASK_AREA (generic location words + city names, not automotive branches)", () => {
    expect(PropertyIntentDetector.detect("lokasinya dimana kak?")).toContain(
      PropertyDetectedIntent.ASK_AREA,
    );
    expect(PropertyIntentDetector.detect("area jakarta ada?")).toContain(
      PropertyDetectedIntent.ASK_AREA,
    );
  });

  it("detects HESITATION (original + quality + trust + price + comparison + cancel groups)", () => {
    expect(PropertyIntentDetector.detect("pikir dulu ya")).toContain(
      PropertyDetectedIntent.HESITATION,
    );
    expect(PropertyIntentDetector.detect("beneran bagus gak sih")).toContain(
      PropertyDetectedIntent.HESITATION,
    );
    expect(PropertyIntentDetector.detect("takut ada masalah legalitas")).toContain(
      PropertyDetectedIntent.HESITATION,
    );
    expect(PropertyIntentDetector.detect("kok mahal banget")).toContain(
      PropertyDetectedIntent.HESITATION,
    );
    expect(PropertyIntentDetector.detect("di developer lain lebih murah")).toContain(
      PropertyDetectedIntent.HESITATION,
    );
    expect(PropertyIntentDetector.detect("gak jadi deh")).toContain(
      PropertyDetectedIntent.HESITATION,
    );
  });

  it("detects GREETING / AFFIRMATIVE / BUDGET / CASH / KPR / SYARIAH / COMPLAINT", () => {
    expect(PropertyIntentDetector.detect("halo kak")).toContain(PropertyDetectedIntent.GREETING);
    expect(PropertyIntentDetector.detect("oke siap")).toContain(PropertyDetectedIntent.AFFIRMATIVE);
    expect(PropertyIntentDetector.detect("budget 2 miliar")).toContain(
      PropertyDetectedIntent.BUDGET,
    );
    expect(PropertyIntentDetector.detect("mau cash aja")).toContain(PropertyDetectedIntent.CASH);
    expect(PropertyIntentDetector.detect("rencana KPR")).toContain(PropertyDetectedIntent.KPR);
    expect(PropertyIntentDetector.detect("ada opsi syariah?")).toContain(
      PropertyDetectedIntent.SYARIAH,
    );
    expect(PropertyIntentDetector.detect("kecewa banget sama unitnya")).toContain(
      PropertyDetectedIntent.COMPLAINT,
    );
  });

  it("a message with no matching pattern detects no intents", () => {
    expect(PropertyIntentDetector.detect("zzz")).toHaveLength(0);
  });

  it("a message can match several intents at once", () => {
    const intents = PropertyIntentDetector.detect("halo kak, ada rumah budget 2 miliar gak?");
    expect(intents).toEqual(
      expect.arrayContaining([
        PropertyDetectedIntent.GREETING,
        PropertyDetectedIntent.ASK_LISTING,
        PropertyDetectedIntent.BUDGET,
      ]),
    );
  });

  it("ALL_PROPERTY_DETECTED_INTENTS has exactly the 12 declared members", () => {
    expect(ALL_PROPERTY_DETECTED_INTENTS).toHaveLength(12);
  });

  describe(".has", () => {
    it("returns true/false for a single intent without computing the full list", () => {
      expect(PropertyIntentDetector.has("mau rumah kak", PropertyDetectedIntent.ASK_LISTING)).toBe(
        true,
      );
      expect(PropertyIntentDetector.has("zzz", PropertyDetectedIntent.ASK_LISTING)).toBe(false);
    });
  });
});
