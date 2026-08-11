import { BranchId } from "@aos/branch-manager";
import { beforeEach, describe, expect, it } from "vitest";

import { ConversationEngine } from "../../../src/conversation/ConversationEngine.js";
import { ResponseGenerator } from "../../../src/conversation/ResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { InventoryQuerier } from "../../../src/intelligence/InventoryQuerier.js";
import { makeRealSyncedInventoryQueryService } from "../../fixtures/salesAgentFixtures.js";
import { unwrap } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");
const THRESHOLDS = { warmThreshold: 31, hotThreshold: 65 };
const CLOSING_INTENT_PATTERN = /test\s*drive|survei|survey|jadwal/i;

function withTurns(inboundCount: number, score: number): LeadConversation {
  let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
  for (let i = 0; i < inboundCount; i += 1) {
    conversation = conversation
      .withAppendedMessage({ isInbound: true } as never, NOW)
      .withAppendedMessage({ isInbound: false } as never, NOW);
  }
  return conversation.withScore(LeadScore.zero().apply(score));
}

describe("ConversationEngine — closing (AAOS-W3D Fix 1)", () => {
  let engine: ConversationEngine;

  beforeEach(async () => {
    const queryService = await makeRealSyncedInventoryQueryService();
    const inventoryQuerier = new InventoryQuerier(queryService);
    engine = new ConversationEngine(
      inventoryQuerier,
      THRESHOLDS,
      new ResponseGenerator(),
      () => "Sales Cinere",
    );
  });

  it("WARM lead, turn 4 → CLOSING stage, response mentions test drive/survey/jadwal", async () => {
    const conversation = withTurns(4, 50);
    const decision = unwrap(await engine.decide(conversation, "oke deh"));
    expect(decision.nextStage).toBe(ConversationStage.CLOSING);
    expect(CLOSING_INTENT_PATTERN.test(decision.responseText)).toBe(true);
  });

  it("HOT lead → CLOSING stage, response mentions test drive/survey/jadwal (HOT pool)", async () => {
    const conversation = withTurns(2, 70);
    const decision = unwrap(await engine.decide(conversation, "oke lanjut kak"));
    expect(decision.nextStage).toBe(ConversationStage.CLOSING);
    expect(CLOSING_INTENT_PATTERN.test(decision.responseText)).toBe(true);
  });

  it("COLD lead (score < warmThreshold) → never CLOSING, regardless of turn count", async () => {
    const conversation = withTurns(8, 20);
    const decision = unwrap(await engine.decide(conversation, "masih liat-liat aja"));
    expect(decision.nextStage).not.toBe(ConversationStage.CLOSING);
  });

  it("every CLOSING response stays ≤ 150 chars", async () => {
    const conversation = withTurns(4, 50);
    const decision = unwrap(await engine.decide(conversation, "oke deh"));
    expect(decision.responseText.length).toBeLessThanOrEqual(150);
  });

  it("CLOSING response is deterministic across identical calls (same seed)", async () => {
    const conversation = withTurns(4, 50);
    const first = unwrap(await engine.decide(conversation, "oke deh"));
    const second = unwrap(await engine.decide(conversation, "oke deh"));
    expect(first.responseText).toBe(second.responseText);
  });
});
