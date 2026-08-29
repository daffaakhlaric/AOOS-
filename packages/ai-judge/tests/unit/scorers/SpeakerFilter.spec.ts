import { describe, expect, it } from "vitest";

import { buyerMessages, claraMessages } from "../../../src/scorers/SpeakerFilter.js";
import { BUYER, CLARA, makeMessage } from "../../fixtures/simulationResultFixtures.js";

describe("SpeakerFilter", () => {
  it("claraMessages() returns only CLARA-authored messages, in order", () => {
    const messages = [
      makeMessage(1, BUYER, "halo"),
      makeMessage(2, CLARA, "hai"),
      makeMessage(3, CLARA, "oke"),
    ];
    expect(claraMessages(messages).map((m) => m.text)).toEqual(["hai", "oke"]);
  });

  it("buyerMessages() returns only BUYER-authored messages, in order", () => {
    const messages = [
      makeMessage(1, BUYER, "halo"),
      makeMessage(2, CLARA, "hai"),
      makeMessage(3, BUYER, "oke"),
    ];
    expect(buyerMessages(messages).map((m) => m.text)).toEqual(["halo", "oke"]);
  });

  it("empty message list -> empty results for both filters", () => {
    expect(claraMessages([])).toEqual([]);
    expect(buyerMessages([])).toEqual([]);
  });
});
