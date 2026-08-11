import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { DetectedIntent } from "../../../src/conversation/IntentDetector.js";
import { StageDetector } from "../../../src/conversation/StageDetector.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");
const THRESHOLDS = { warmThreshold: 31, hotThreshold: 65 };

/** Simulates `ConversationPipeline` having already appended `n` messages (mixed in/outbound) — StageDetector's real-world input shape. */
function withHistory(n: number): LeadConversation {
  let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
  for (let i = 0; i < n; i += 1) {
    conversation = conversation.withAppendedMessage({ isInbound: i % 2 === 0 } as never, NOW);
  }
  return conversation;
}

describe("StageDetector", () => {
  it("brand-new conversation (exactly 1 message: the just-appended inbound one) → GREETING", () => {
    expect(StageDetector.detect(withHistory(1), [], THRESHOLDS)).toBe(ConversationStage.GREETING);
  });

  it("score 0-30, < 3 exchanges → DISCOVERY", () => {
    const conversation = withHistory(3).withScore(LeadScore.zero());
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.DISCOVERY);
  });

  it("score 31-64 → QUALIFICATION", () => {
    const conversation = withHistory(3).withScore(LeadScore.zero().apply(50));
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(
      ConversationStage.QUALIFICATION,
    );
  });

  it("asking unit details → UNIT_INFO", () => {
    expect(StageDetector.detect(withHistory(3), [DetectedIntent.ASK_UNIT], THRESHOLDS)).toBe(
      ConversationStage.UNIT_INFO,
    );
  });

  it("asking price → PRICE_INFO", () => {
    expect(StageDetector.detect(withHistory(3), [DetectedIntent.ASK_PRICE], THRESHOLDS)).toBe(
      ConversationStage.PRICE_INFO,
    );
  });

  it("hesitation → OBJECTION", () => {
    expect(StageDetector.detect(withHistory(3), [DetectedIntent.HESITATION], THRESHOLDS)).toBe(
      ConversationStage.OBJECTION,
    );
  });

  it("score ≥ 65 → CLOSING", () => {
    const conversation = withHistory(3).withScore(LeadScore.zero().apply(70));
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
  });

  it("score ≥ 65 wins over an ASK_UNIT intent (HOT takes priority)", () => {
    const conversation = withHistory(3).withScore(LeadScore.zero().apply(70));
    expect(StageDetector.detect(conversation, [DetectedIntent.ASK_UNIT], THRESHOLDS)).toBe(
      ConversationStage.CLOSING,
    );
  });

  it("score < 31 with 3+ exchanges falls through to QUALIFICATION, not DISCOVERY", () => {
    // 5 appended messages ⇒ inboundMessageCount = 3 (indices 0,2,4).
    expect(StageDetector.detect(withHistory(5), [], THRESHOLDS)).toBe(
      ConversationStage.QUALIFICATION,
    );
  });

  it("exactly 1 prior exchange (score 0) with an empty history beyond the current message stays DISCOVERY-eligible once a 2nd message arrives", () => {
    const conversation = withHistory(2).withScore(LeadScore.zero());
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.DISCOVERY);
  });

  // AAOS-W3A-S1 Fix 2: COMPLAINT is a new intent, also routed to OBJECTION.
  it("COMPLAINT → OBJECTION (AAOS-W3A-S1)", () => {
    expect(StageDetector.detect(withHistory(3), [DetectedIntent.COMPLAINT], THRESHOLDS)).toBe(
      ConversationStage.OBJECTION,
    );
  });

  it("COMPLAINT + HESITATION together → still OBJECTION (AAOS-W3A-S1)", () => {
    expect(
      StageDetector.detect(
        withHistory(3),
        [DetectedIntent.COMPLAINT, DetectedIntent.HESITATION],
        THRESHOLDS,
      ),
    ).toBe(ConversationStage.OBJECTION);
  });

  it("score ≥ 65 wins over a COMPLAINT intent (HOT takes priority, AAOS-W3A-S1)", () => {
    const conversation = withHistory(3).withScore(LeadScore.zero().apply(70));
    expect(StageDetector.detect(conversation, [DetectedIntent.COMPLAINT], THRESHOLDS)).toBe(
      ConversationStage.CLOSING,
    );
  });

  it("ASK_PRICE wins over COMPLAINT (explicit price question still takes priority, AAOS-W3A-S1)", () => {
    expect(
      StageDetector.detect(
        withHistory(3),
        [DetectedIntent.ASK_PRICE, DetectedIntent.COMPLAINT],
        THRESHOLDS,
      ),
    ).toBe(ConversationStage.PRICE_INFO);
  });
});
