import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { nextPropertyCriterionToAsk } from "../../../src/responses/PropertyQualificationResponses.js";

const NOW = new Date("2026-08-20T09:00:00.000Z");

function withInboundMessages(...texts: string[]): LeadConversation {
  let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
  for (const text of texts) {
    conversation = conversation.withAppendedMessage({ isInbound: true, text } as never, NOW);
  }
  return conversation;
}

describe("nextPropertyCriterionToAsk", () => {
  it("no messages yet → asks the first dimension (BUDGET)", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    expect(nextPropertyCriterionToAsk(conversation)?.criterion).toBe("BUDGET");
  });

  it("BUDGET already mentioned → asks the next dimension (PROPERTY_TYPE)", () => {
    const conversation = withInboundMessages("budget 2 miliar kak");
    expect(nextPropertyCriterionToAsk(conversation)?.criterion).toBe("PROPERTY_TYPE");
  });

  it("BUDGET + PROPERTY_TYPE mentioned → asks AREA next", () => {
    const conversation = withInboundMessages("budget 2 miliar kak, mau cari rumah");
    expect(nextPropertyCriterionToAsk(conversation)?.criterion).toBe("AREA");
  });

  it("every dimension mentioned across multiple turns → undefined (nothing left to ask)", () => {
    const conversation = withInboundMessages(
      "budget 2 miliar",
      "mau cari rumah",
      "area bintaro",
      "rencana KPR",
      "bulan ini",
      "butuh 3 kamar",
    );
    expect(nextPropertyCriterionToAsk(conversation)).toBeUndefined();
  });

  it("only reads INBOUND messages, ignoring Jessy's own outbound text", () => {
    let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    conversation = conversation.withAppendedMessage(
      { isInbound: false, text: "budget berapa kak?" } as never,
      NOW,
    );
    expect(nextPropertyCriterionToAsk(conversation)?.criterion).toBe("BUDGET");
  });
});
