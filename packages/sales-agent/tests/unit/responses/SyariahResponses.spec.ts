import { describe, expect, it } from "vitest";

import { DetectedIntent } from "../../../src/conversation/IntentDetector.js";
import { ResponseGenerator } from "../../../src/conversation/ResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import {
  SYARIAH_DP_RESPONSE_POOL,
  SYARIAH_RESPONSE_POOL,
  SYARIAH_TRUST_RESPONSE_POOL,
} from "../../../src/responses/SyariahResponses.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function mentionsSyariahWording(text: string): boolean {
  return text.includes("syariah") || text.includes("halal") || text.includes("murabahah");
}

describe("SyariahResponses (pools)", () => {
  it("SYARIAH_RESPONSE_POOL: every entry mentions syariah/halal/murabahah and stays ≤ 300 chars", () => {
    expect(SYARIAH_RESPONSE_POOL.length).toBeGreaterThan(0);
    for (const entry of SYARIAH_RESPONSE_POOL) {
      expect(mentionsSyariahWording(entry)).toBe(true);
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });

  it("SYARIAH_DP_RESPONSE_POOL: every entry mentions syariah/halal/murabahah and stays ≤ 300 chars", () => {
    expect(SYARIAH_DP_RESPONSE_POOL.length).toBeGreaterThan(0);
    for (const entry of SYARIAH_DP_RESPONSE_POOL) {
      expect(mentionsSyariahWording(entry)).toBe(true);
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });

  it("SYARIAH_TRUST_RESPONSE_POOL: every entry mentions syariah/halal/murabahah and stays ≤ 300 chars", () => {
    expect(SYARIAH_TRUST_RESPONSE_POOL.length).toBeGreaterThan(0);
    for (const entry of SYARIAH_TRUST_RESPONSE_POOL) {
      expect(mentionsSyariahWording(entry)).toBe(true);
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });
});

describe("ResponseGenerator SYARIAH routing (AAOS-W3A-S1 Fix 1)", () => {
  const generator = new ResponseGenerator();
  const conversation = LeadConversation.start("+6281200000002", BranchId.CINERE, NOW);

  it("SYARIAH alone (no ASK_PRICE/HESITATION) → SYARIAH_RESPONSE_POOL, mentions syariah wording", () => {
    const text = generator.generate({
      conversation,
      stage: ConversationStage.DISCOVERY,
      intents: [DetectedIntent.SYARIAH],
      messageText: "ada syariah gak kak?",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(SYARIAH_RESPONSE_POOL).toContain(text);
    expect(mentionsSyariahWording(text)).toBe(true);
  });

  it("SYARIAH + ASK_PRICE → SYARIAH_DP_RESPONSE_POOL (overrides the generic KREDIT/DP flow)", () => {
    const text = generator.generate({
      conversation,
      stage: ConversationStage.PRICE_INFO,
      intents: [DetectedIntent.SYARIAH, DetectedIntent.ASK_PRICE],
      messageText: "ada kredit syariah gak?",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(SYARIAH_DP_RESPONSE_POOL).toContain(text);
    expect(mentionsSyariahWording(text)).toBe(true);
  });

  it("SYARIAH + HESITATION → SYARIAH_TRUST_RESPONSE_POOL", () => {
    const text = generator.generate({
      conversation,
      stage: ConversationStage.OBJECTION,
      intents: [DetectedIntent.SYARIAH, DetectedIntent.HESITATION],
      messageText: "saya takut riba nih",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(SYARIAH_TRUST_RESPONSE_POOL).toContain(text);
    expect(mentionsSyariahWording(text)).toBe(true);
  });

  it("SYARIAH + ASK_PRICE + HESITATION → ASK_PRICE wins (DP pool), same priority order as ObjectionResponses", () => {
    const text = generator.generate({
      conversation,
      stage: ConversationStage.PRICE_INFO,
      intents: [DetectedIntent.SYARIAH, DetectedIntent.ASK_PRICE, DetectedIntent.HESITATION],
      messageText: "dp syariah nya berapa, takut kemahalan",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(SYARIAH_DP_RESPONSE_POOL).toContain(text);
  });

  it("SYARIAH intent at CLOSING stage does NOT override the closing CTA (terminal stages are excluded)", () => {
    const text = generator.generate({
      conversation,
      stage: ConversationStage.CLOSING,
      intents: [DetectedIntent.SYARIAH],
      messageText: "oke halal ya berarti",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(SYARIAH_RESPONSE_POOL).not.toContain(text);
    expect(SYARIAH_DP_RESPONSE_POOL).not.toContain(text);
    expect(SYARIAH_TRUST_RESPONSE_POOL).not.toContain(text);
  });

  it("SYARIAH intent at HANDOFF stage does NOT override the handoff message (still names the sales rep)", () => {
    const text = generator.generate({
      conversation,
      stage: ConversationStage.HANDOFF,
      intents: [DetectedIntent.SYARIAH],
      messageText: "oke inshaallah",
      matchedUnits: [],
      branchName: "Mobix Cinere",
      salesName: "Budi Santoso",
    });
    expect(text).toContain("Budi Santoso");
  });

  it("SYARIAH override response stays ≤ 300 chars across GREETING/UNIT_INFO/PRICE_INFO/OBJECTION stages", () => {
    const stages = [
      ConversationStage.GREETING,
      ConversationStage.DISCOVERY,
      ConversationStage.QUALIFICATION,
      ConversationStage.UNIT_INFO,
      ConversationStage.PRICE_INFO,
      ConversationStage.OBJECTION,
    ];
    for (const stage of stages) {
      const text = generator.generate({
        conversation,
        stage,
        intents: [DetectedIntent.SYARIAH],
        messageText: "ada syariah?",
        matchedUnits: [],
        branchName: "Mobix Cinere",
      });
      expect(text.length).toBeLessThanOrEqual(300);
    }
  });
});
