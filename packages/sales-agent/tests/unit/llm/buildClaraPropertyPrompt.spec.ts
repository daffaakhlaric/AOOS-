import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import type { PropertyResponseContext } from "../../../src/contracts/IPropertyResponseGenerator.js";
import { PropertyDetectedIntent } from "../../../src/conversation/PropertyIntentDetector.js";
import {
  ConversationMessage,
  MessageDirection,
} from "../../../src/domain/entities/ConversationMessage.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import type { PropertyListing } from "../../../src/domain/entities/PropertyListing.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import {
  buildPropertyConversationMessages,
  buildPropertySystemPrompt,
} from "../../../src/llm/buildClaraPropertyPrompt.js";

const NOW = new Date("2026-08-20T09:00:00.000Z");
const LISTING: PropertyListing = {
  id: "l1",
  title: "Rumah Bintaro",
  propertyType: "RUMAH",
  price: 1_500_000_000,
  bedrooms: 3,
  city: "Bintaro",
};

function context(overrides: Partial<PropertyResponseContext> = {}): PropertyResponseContext {
  return {
    conversation: LeadConversation.start("+6281200000001", BranchId.BINTARO, NOW),
    stage: ConversationStage.GREETING,
    intents: [],
    messageText: "halo min",
    matchedListings: [],
    ...overrides,
  };
}

describe("buildPropertySystemPrompt", () => {
  it("fills {score}/{stage} from the real conversation state", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.BINTARO, NOW).withScore(
      LeadScore.zero().apply(42),
    );
    const prompt = buildPropertySystemPrompt(
      context({ stage: ConversationStage.QUALIFICATION, conversation }),
    );
    expect(prompt).toContain("Lead score: 42/100");
    expect(prompt).toContain("Stage: QUALIFICATION");
  });

  it("fills {matched_listings} with real listing data when present", () => {
    const prompt = buildPropertySystemPrompt(
      context({ stage: ConversationStage.UNIT_INFO, matchedListings: [LISTING] }),
    );
    expect(prompt).toContain("Rumah Bintaro");
    expect(prompt).toContain("RUMAH");
    expect(prompt).toContain("3 KT");
    expect(prompt).toContain("Bintaro");
  });

  it("{matched_listings} → honest 'no match' text when empty", () => {
    const prompt = buildPropertySystemPrompt(context({ stage: ConversationStage.UNIT_INFO }));
    expect(prompt).toContain("tidak ada listing yang cocok saat ini");
  });

  it("fills {requested_property_type}/{alternative_city} when set", () => {
    const prompt = buildPropertySystemPrompt(
      context({
        stage: ConversationStage.UNIT_INFO,
        requestedPropertyType: "APARTEMEN",
        alternativeCity: "Cinere",
      }),
    );
    expect(prompt).toContain("APARTEMEN");
    expect(prompt).toContain("Cinere");
  });

  it("{requested_property_type}/{alternative_city} → honest defaults when unset", () => {
    const prompt = buildPropertySystemPrompt(context({ stage: ConversationStage.UNIT_INFO }));
    expect(prompt).toContain("belum jelas");
    expect(prompt).toContain("tidak ada");
  });

  it("fills {sales_name} — real name when given, default otherwise", () => {
    const withName = buildPropertySystemPrompt(
      context({ stage: ConversationStage.HANDOFF, salesName: "Sales Bintaro" }),
    );
    expect(withName).toContain("Sales Bintaro");
    const withoutName = buildPropertySystemPrompt(context({ stage: ConversationStage.HANDOFF }));
    expect(withoutName).toContain("tim sales kita");
  });

  it("fills {detected_intents} from context.intents, honest default when empty", () => {
    const withIntent = buildPropertySystemPrompt(
      context({ intents: [PropertyDetectedIntent.SYARIAH, PropertyDetectedIntent.BUDGET] }),
    );
    expect(withIntent).toContain("SYARIAH, BUDGET");
    const withoutIntent = buildPropertySystemPrompt(context());
    expect(withoutIntent).toContain("tidak ada sinyal spesifik");
  });

  it("fills {stage_instruction} per stage — CLOSING mentions survei/jadwal wording", () => {
    const prompt = buildPropertySystemPrompt(context({ stage: ConversationStage.CLOSING }));
    expect(prompt).toMatch(/survei|jadwal/);
  });

  it("fills {stage_instruction} per stage — HANDOFF mentions the literal 'tim kita' phrase", () => {
    const prompt = buildPropertySystemPrompt(context({ stage: ConversationStage.HANDOFF }));
    expect(prompt).toContain("tim kita");
  });

  it("promptOverride REPLACES the whole template, still goes through the same slot substitution", () => {
    const override = "Override. Stage: {stage}. Score: {score}. {stage_instruction}";
    const prompt = buildPropertySystemPrompt(
      context({ stage: ConversationStage.DISCOVERY }),
      override,
    );
    expect(prompt).toContain("Override. Stage: DISCOVERY. Score: 0.");
    expect(prompt).not.toContain("Mobix");
  });

  it("promptOverride omitted → uses the default PROPERTY template (contains real persona wording)", () => {
    const prompt = buildPropertySystemPrompt(context());
    expect(prompt).toContain("sales AI properti");
  });

  it("never fabricates a {lead_profile}-style slot — the real PropertyResponseContext carries no aggregate profile", () => {
    const prompt = buildPropertySystemPrompt(context());
    expect(prompt).not.toContain("{lead_profile}");
    expect(prompt).not.toContain("{branch}");
  });
});

describe("buildPropertyConversationMessages", () => {
  it("puts the system prompt first, followed by conversation history", async () => {
    const messages = buildPropertyConversationMessages(context());
    expect(messages[0]?.role).toBe("system");
  });

  it("maps inbound/outbound conversation messages to user/assistant roles", () => {
    const inbound = ConversationMessage.create({
      text: "halo",
      direction: MessageDirection.INBOUND,
      occurredAt: NOW,
    });
    const outbound = ConversationMessage.create({
      text: "Hai kak!",
      direction: MessageDirection.OUTBOUND,
      occurredAt: NOW,
    });
    if (!inbound.ok || !outbound.ok) {
      throw new Error("fixture message creation failed");
    }
    const conversation = LeadConversation.start("+6281200000001", BranchId.BINTARO, NOW)
      .withAppendedMessage(inbound.value, NOW)
      .withAppendedMessage(outbound.value, NOW);
    const messages = buildPropertyConversationMessages(context({ conversation }));
    expect(messages[1]?.role).toBe("user");
    expect(messages[1]?.content).toBe("halo");
    expect(messages[2]?.role).toBe("assistant");
    expect(messages[2]?.content).toBe("Hai kak!");
  });
});
