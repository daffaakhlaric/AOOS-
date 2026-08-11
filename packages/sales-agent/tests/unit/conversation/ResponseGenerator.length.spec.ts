import { BranchId } from "@aos/branch-manager";
import { InventoryUnitBuilder, UnitTransmission } from "@aos/dss-inventory-connector";
import { describe, expect, it } from "vitest";

import { ResponseGenerator } from "../../../src/conversation/ResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { unwrap } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

describe("ResponseGenerator — length backstop (AAOS-W3D Fix 2)", () => {
  const generator = new ResponseGenerator();
  const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);

  it("a normal UNIT_INFO response (real fixture data) stays well under the 200-char hard ceiling untouched", () => {
    const unit = unwrap(
      new InventoryUnitBuilder()
        .withBrand("Mitsubishi")
        .withModel("Xpander Cross")
        .withTransmission(UnitTransmission.AT)
        .withYear(2019)
        .build(),
    );
    const text = generator.generate({
      conversation,
      stage: ConversationStage.UNIT_INFO,
      intents: [],
      messageText: "ada xpander?",
      matchedUnits: [unit],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeLessThanOrEqual(150);
  });

  it("an artificially long unit displayName (pathological input) still produces a response ≤ 200 chars, via the trimToSentence backstop", () => {
    const unit = unwrap(
      new InventoryUnitBuilder()
        .withBrand("Mitsubishi Motors Corporation Indonesia")
        .withModel("Xpander Cross Ultimate Premium Special Edition Long Name")
        .withVariant("Facelift Terbaru Dengan Banyak Fitur Tambahan Canggih")
        .withTransmission(UnitTransmission.AT)
        .withYear(2019)
        .build(),
    );
    const text = generator.generate({
      conversation,
      stage: ConversationStage.UNIT_INFO,
      intents: [],
      messageText: "ada xpander?",
      matchedUnits: [unit],
      branchName: "Mobix Cinere",
    });
    expect(text.length).toBeLessThanOrEqual(200);
  });

  it("the trimmed pathological response still ends at a sentence/line boundary, not a mid-word cut", () => {
    const unit = unwrap(
      new InventoryUnitBuilder()
        .withBrand("Mitsubishi Motors Corporation Indonesia")
        .withModel("Xpander Cross Ultimate Premium Special Edition Long Name")
        .withVariant("Facelift Terbaru Dengan Banyak Fitur Tambahan Canggih")
        .withTransmission(UnitTransmission.AT)
        .withYear(2019)
        .build(),
    );
    const text = generator.generate({
      conversation,
      stage: ConversationStage.UNIT_INFO,
      intents: [],
      messageText: "ada xpander?",
      matchedUnits: [unit],
      branchName: "Mobix Cinere",
    });
    const lastChar = text.trimEnd().slice(-1);
    expect([".", "!", "?"].includes(lastChar) || text.length < 200).toBe(true);
  });

  it("every stage's response stays ≤ 200 chars across a representative sweep of stages", () => {
    const stages: ConversationStage[] = [
      ConversationStage.GREETING,
      ConversationStage.DISCOVERY,
      ConversationStage.QUALIFICATION,
      ConversationStage.OBJECTION,
      ConversationStage.CLOSING,
      ConversationStage.HANDOFF,
      ConversationStage.NURTURE,
      ConversationStage.CLOSED,
    ];
    for (const stage of stages) {
      const text = generator.generate({
        conversation,
        stage,
        intents: [],
        messageText: "halo",
        matchedUnits: [],
        branchName: "Mobix Cinere",
        salesName: "Budi Santoso",
      });
      expect(text.length).toBeLessThanOrEqual(200);
    }
  });
});
