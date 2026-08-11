import { describe, expect, it } from "vitest";

import { buyerMessages, jessyMessages } from "../../../src/scorers/SpeakerFilter.js";
import { BUYER, JESSY, makeMessage } from "../../fixtures/simulationResultFixtures.js";

describe("SpeakerFilter", () => {
  it("jessyMessages() returns only JESSY-authored messages, in order", () => {
    const messages = [
      makeMessage(1, BUYER, "halo"),
      makeMessage(2, JESSY, "hai"),
      makeMessage(3, JESSY, "oke"),
    ];
    expect(jessyMessages(messages).map((m) => m.text)).toEqual(["hai", "oke"]);
  });

  it("buyerMessages() returns only BUYER-authored messages, in order", () => {
    const messages = [
      makeMessage(1, BUYER, "halo"),
      makeMessage(2, JESSY, "hai"),
      makeMessage(3, BUYER, "oke"),
    ];
    expect(buyerMessages(messages).map((m) => m.text)).toEqual(["halo", "oke"]);
  });

  it("empty message list -> empty results for both filters", () => {
    expect(jessyMessages([])).toEqual([]);
    expect(buyerMessages([])).toEqual([]);
  });
});
