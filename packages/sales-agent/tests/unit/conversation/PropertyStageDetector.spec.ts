import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { PropertyDetectedIntent } from "../../../src/conversation/PropertyIntentDetector.js";
import { PropertyStageDetector } from "../../../src/conversation/PropertyStageDetector.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";

const NOW = new Date("2026-08-20T09:00:00.000Z");
const THRESHOLDS = { warmThreshold: 30, hotThreshold: 65 };

function withHistory(n: number): LeadConversation {
  let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
  for (let i = 0; i < n; i += 1) {
    conversation = conversation.withAppendedMessage({ isInbound: i % 2 === 0 } as never, NOW);
  }
  return conversation;
}

describe("PropertyStageDetector", () => {
  it("brand-new conversation → GREETING", () => {
    expect(PropertyStageDetector.detect(withHistory(1), [], THRESHOLDS)).toBe(
      ConversationStage.GREETING,
    );
  });

  it("score 0-29, < 3 exchanges → DISCOVERY", () => {
    const conversation = withHistory(3).withScore(LeadScore.zero());
    expect(PropertyStageDetector.detect(conversation, [], THRESHOLDS)).toBe(
      ConversationStage.DISCOVERY,
    );
  });

  it("score 30-64 → QUALIFICATION", () => {
    const conversation = withHistory(3).withScore(LeadScore.zero().apply(50));
    expect(PropertyStageDetector.detect(conversation, [], THRESHOLDS)).toBe(
      ConversationStage.QUALIFICATION,
    );
  });

  it("asking listing details → UNIT_INFO", () => {
    expect(
      PropertyStageDetector.detect(
        withHistory(3),
        [PropertyDetectedIntent.ASK_LISTING],
        THRESHOLDS,
      ),
    ).toBe(ConversationStage.UNIT_INFO);
  });

  it("asking price → PRICE_INFO", () => {
    expect(
      PropertyStageDetector.detect(withHistory(3), [PropertyDetectedIntent.ASK_PRICE], THRESHOLDS),
    ).toBe(ConversationStage.PRICE_INFO);
  });

  it("hesitation → OBJECTION", () => {
    expect(
      PropertyStageDetector.detect(withHistory(3), [PropertyDetectedIntent.HESITATION], THRESHOLDS),
    ).toBe(ConversationStage.OBJECTION);
  });

  it("complaint → OBJECTION", () => {
    expect(
      PropertyStageDetector.detect(withHistory(3), [PropertyDetectedIntent.COMPLAINT], THRESHOLDS),
    ).toBe(ConversationStage.OBJECTION);
  });

  it("score >= 65 → CLOSING (HOT takes priority over ASK_LISTING)", () => {
    const conversation = withHistory(3).withScore(LeadScore.zero().apply(70));
    expect(
      PropertyStageDetector.detect(conversation, [PropertyDetectedIntent.ASK_LISTING], THRESHOLDS),
    ).toBe(ConversationStage.CLOSING);
  });

  it("ASK_PRICE wins over ASK_LISTING", () => {
    expect(
      PropertyStageDetector.detect(
        withHistory(3),
        [PropertyDetectedIntent.ASK_PRICE, PropertyDetectedIntent.ASK_LISTING],
        THRESHOLDS,
      ),
    ).toBe(ConversationStage.PRICE_INFO);
  });

  it("score < 30 with 3+ exchanges falls through to QUALIFICATION, not DISCOVERY", () => {
    expect(PropertyStageDetector.detect(withHistory(5), [], THRESHOLDS)).toBe(
      ConversationStage.QUALIFICATION,
    );
  });

  it("WARM score, turn >= 4, no prior closing attempts → CLOSING", () => {
    const conversation = withHistory(7).withScore(LeadScore.zero().apply(40));
    expect(PropertyStageDetector.detect(conversation, [], THRESHOLDS)).toBe(
      ConversationStage.CLOSING,
    );
  });

  it("WARM score, already attempted closing twice at the same score → stays QUALIFICATION (capped)", () => {
    const conversation = withHistory(7)
      .withScore(LeadScore.zero().apply(40))
      .withClosingAttempt()
      .withClosingAttempt();
    expect(PropertyStageDetector.detect(conversation, [], THRESHOLDS)).toBe(
      ConversationStage.QUALIFICATION,
    );
  });
});
