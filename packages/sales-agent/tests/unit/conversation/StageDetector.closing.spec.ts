import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { StageDetector } from "../../../src/conversation/StageDetector.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");
const THRESHOLDS = { warmThreshold: 31, hotThreshold: 65 };

/** Builds a conversation with exactly `inboundCount` inbound messages (alternating with outbound replies in between, matching real conversation shape) at the given `score`. */
function withTurns(inboundCount: number, score: number): LeadConversation {
  let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
  for (let i = 0; i < inboundCount; i += 1) {
    conversation = conversation
      .withAppendedMessage({ isInbound: true } as never, NOW)
      .withAppendedMessage({ isInbound: false } as never, NOW);
  }
  return conversation.withScore(LeadScore.zero().apply(score));
}

describe("StageDetector — WARM closing push (AAOS-W3D Fix 1)", () => {
  it("pinned: score=50, turn=4 → CLOSING triggered", () => {
    const conversation = withTurns(4, 50);
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
  });

  it("pinned: score=65, turn=2 → CLOSING triggered immediately (HOT, top-priority rule, unaffected by turn count)", () => {
    const conversation = withTurns(2, 65);
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
  });

  it("pinned: score=20, turn=8 → CLOSING NOT triggered (too cold, score gate still applies)", () => {
    const conversation = withTurns(8, 20);
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).not.toBe(ConversationStage.CLOSING);
  });

  it("WARM score but turn=3 (below the min-turn gate) → not CLOSING yet", () => {
    const conversation = withTurns(3, 50);
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).not.toBe(ConversationStage.CLOSING);
  });

  it("WARM score, turn=4, exactly at warmThreshold (31) → CLOSING", () => {
    const conversation = withTurns(4, 31);
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
  });

  it("score just below warmThreshold (30), turn=4 → not CLOSING", () => {
    const conversation = withTurns(4, 30);
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).not.toBe(ConversationStage.CLOSING);
  });

  it("WARM score, turn=10 (well past the gate) → still CLOSING", () => {
    const conversation = withTurns(10, 50);
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
  });

  it("caps repeated closing at 2 attempts with no score change: 3rd attempt falls through to QUALIFICATION", () => {
    let conversation = withTurns(4, 50);
    // 1st attempt.
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
    conversation = conversation.withClosingAttempt();
    // 2nd attempt — still allowed (count < 2).
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
    conversation = conversation.withClosingAttempt();
    // 3rd attempt with no new signal (score unchanged) — capped.
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).not.toBe(ConversationStage.CLOSING);
  });

  it("a new signal (score increased since the last closing attempt) re-permits closing past the cap", () => {
    let conversation = withTurns(4, 50).withClosingAttempt().withClosingAttempt();
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).not.toBe(ConversationStage.CLOSING);
    conversation = conversation.withScore(LeadScore.zero().apply(60));
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
  });

  it("HOT score always wins regardless of the WARM-closing cap", () => {
    const conversation = withTurns(4, 50)
      .withClosingAttempt()
      .withClosingAttempt()
      .withScore(LeadScore.zero().apply(70));
    expect(StageDetector.detect(conversation, [], THRESHOLDS)).toBe(ConversationStage.CLOSING);
  });
});
