import { describe, expect, it } from "vitest";

import { ConversationStage } from "../../../../src/domain/value-objects/ConversationStage.js";

describe("ConversationStage", () => {
  it("has all 10 spec-defined stages", () => {
    expect(Object.values(ConversationStage)).toEqual([
      "GREETING",
      "DISCOVERY",
      "QUALIFICATION",
      "UNIT_INFO",
      "PRICE_INFO",
      "OBJECTION",
      "CLOSING",
      "HANDOFF",
      "NURTURE",
      "CLOSED",
    ]);
  });
});
