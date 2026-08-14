import { BranchId } from "@aos/branch-manager";
import { InventoryUnitBuilder, UnitTransmission } from "@aos/dss-inventory-connector";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DetectedIntent } from "../../../src/conversation/IntentDetector.js";
import { ResponseGenerator } from "../../../src/conversation/ResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { GREETING_POOL } from "../../../src/responses/GreetingResponses.js";
import { unwrap } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function unit() {
  return unwrap(
    new InventoryUnitBuilder()
      .withBrand("Mitsubishi")
      .withModel("Xpander Cross")
      .withVariant("Ultimate")
      .withYear(2019)
      .withTransmission(UnitTransmission.AT)
      .withColor("Putih")
      .withKilometer(45_000)
      .withPrice(195_000_000)
      .withBranch(Branch.CINERE)
      .build(),
  );
}

describe("ResponseGenerator", () => {
  const generator = new ResponseGenerator();
  const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);

  it("greeting → one of the valid GREETING_POOL options", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.GREETING,
      intents: [],
      messageText: "halo",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(GREETING_POOL).toContain(text);
  });

  it("unit found → includes the real price and km", async () => {
    const found = unit();
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.UNIT_INFO,
      intents: [DetectedIntent.ASK_UNIT],
      messageText: "ada xpander?",
      matchedUnits: [found],
      branchName: "Mobix Cinere",
    });
    expect(text).toContain("195.000.000");
    expect(text).toContain("45.000");
  });

  it("unit not found → mentions the branch and stock", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.UNIT_INFO,
      intents: [DetectedIntent.ASK_UNIT],
      messageText: "ada rush?",
      matchedUnits: [],
      requestedModel: "Rush",
      branchName: "Mobix Cinere",
    });
    expect(text).toContain("Rush");
    expect(text).toContain("Mobix Cinere");
  });

  it("unit not found without a requestedModel → falls back to a generic phrase", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.UNIT_INFO,
      intents: [DetectedIntent.ASK_UNIT],
      messageText: "ada mobil gak kak?",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text).toContain("unit itu");
  });

  it("dp info → correct estimatedDp and estimatedMonthly (pinned)", async () => {
    const found = unit();
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.PRICE_INFO,
      intents: [DetectedIntent.ASK_PRICE],
      messageText: "dp berapa?",
      matchedUnits: [found],
      branchName: "Mobix Cinere",
    });
    expect(text).toContain(found.estimatedDp.toNumber().toLocaleString("id-ID"));
    expect(text).toContain(found.estimatedMonthly.toNumber().toLocaleString("id-ID"));
  });

  it("objection 'takut bermasalah' → Otospector response", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.OBJECTION,
      intents: [DetectedIntent.HESITATION],
      messageText: "takut bermasalah nih kak",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text).toContain("Otospector");
  });

  it("objection with COMPLAINT intent (AAOS-W3A-S1) → quality objection response mentions Otospector/150", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.OBJECTION,
      intents: [DetectedIntent.COMPLAINT],
      messageText: "kemarin temen beli mobil bekas rusak terus",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.includes("Otospector") || text.includes("150")).toBe(true);
  });

  it("objection with a new broadened HESITATION quality-doubt phrase → still ≤ 300 chars and non-empty", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.OBJECTION,
      intents: [DetectedIntent.HESITATION],
      messageText: "mobilnya beneran bagus gak sih?",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThanOrEqual(300);
  });

  it("handoff → includes the sales name", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.HANDOFF,
      intents: [],
      messageText: "oke siap",
      matchedUnits: [],
      branchName: "Mobix Cinere",
      salesName: "Budi Santoso",
    });
    expect(text).toContain("Budi Santoso");
  });

  it("handoff without a salesName falls back to a default", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.HANDOFF,
      intents: [],
      messageText: "oke",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeGreaterThan(0);
  });

  it("discovery stage → a discovery question", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.DISCOVERY,
      intents: [],
      messageText: "hai",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeGreaterThan(0);
  });

  it("qualification stage → a budget follow-up question", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.QUALIFICATION,
      intents: [],
      messageText: "mau cari mobil",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeGreaterThan(0);
  });

  it("closing stage → pushes toward test drive", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.CLOSING,
      intents: [],
      messageText: "oke",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeGreaterThan(0);
  });

  it("nurture stage → cold nurture response", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.NURTURE,
      intents: [],
      messageText: "-",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeGreaterThan(0);
  });

  it("closed stage → a closing thank-you", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.CLOSED,
      intents: [],
      messageText: "-",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeGreaterThan(0);
  });

  it("price info with no matched unit → asks which unit", async () => {
    const text = await generator.generate({
      conversation,
      stage: ConversationStage.PRICE_INFO,
      intents: [DetectedIntent.ASK_PRICE],
      messageText: "dp berapa?",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeGreaterThan(0);
  });

  it("response selection is deterministic for the same seed", async () => {
    const first = await generator.generate({
      conversation,
      stage: ConversationStage.GREETING,
      intents: [],
      messageText: "halo",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    const second = await generator.generate({
      conversation,
      stage: ConversationStage.GREETING,
      intents: [],
      messageText: "halo",
      matchedUnits: [],
      branchName: "Mobix Cinere",
    });
    expect(first).toBe(second);
  });

  it("all responses across every stage stay ≤ 300 characters", async () => {
    for (const stage of Object.values(ConversationStage)) {
      const text = await generator.generate({
        conversation,
        stage,
        intents: [],
        messageText: "x",
        matchedUnits: [],
        requestedModel: "Rush",
        branchName: "Mobix Cinere",
        salesName: "Budi Santoso",
      });
      expect(text.length).toBeLessThanOrEqual(300);
    }
  });
});
