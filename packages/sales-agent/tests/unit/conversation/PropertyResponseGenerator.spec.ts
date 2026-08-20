import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import type { PropertyResponseContext } from "../../../src/contracts/IPropertyResponseGenerator.js";
import { PropertyDetectedIntent } from "../../../src/conversation/PropertyIntentDetector.js";
import { PropertyResponseGenerator } from "../../../src/conversation/PropertyResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import type { PropertyListing } from "../../../src/domain/entities/PropertyListing.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";

const NOW = new Date("2026-08-20T09:00:00.000Z");
const LISTING: PropertyListing = {
  id: "l1",
  title: "Rumah Bintaro",
  propertyType: "RUMAH",
  price: 1_500_000_000,
  bedrooms: 3,
};

function baseContext(overrides: Partial<PropertyResponseContext> = {}): PropertyResponseContext {
  return {
    conversation: LeadConversation.start("+6281200000001", BranchId.CINERE, NOW),
    stage: ConversationStage.GREETING,
    intents: [],
    messageText: "halo min",
    matchedListings: [],
    ...overrides,
  };
}

describe("PropertyResponseGenerator", () => {
  const generator = new PropertyResponseGenerator();

  it("GREETING → non-empty greeting", async () => {
    const text = await generator.generate(baseContext());
    expect(text.length).toBeGreaterThan(0);
  });

  it("DISCOVERY → non-empty discovery question", async () => {
    const text = await generator.generate(baseContext({ stage: ConversationStage.DISCOVERY }));
    expect(text.length).toBeGreaterThan(0);
  });

  it("QUALIFICATION → asks the next unmentioned dimension", async () => {
    const text = await generator.generate(baseContext({ stage: ConversationStage.QUALIFICATION }));
    expect(text).toBe("Budget propertinya berapa kak? Beli cash atau KPR?");
  });

  it("QUALIFICATION → generic follow-up once every dimension is already mentioned", async () => {
    let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    for (const text of [
      "budget 2 miliar",
      "mau cari rumah",
      "area bintaro",
      "rencana KPR",
      "bulan ini",
      "butuh 3 kamar",
    ]) {
      conversation = conversation.withAppendedMessage({ isInbound: true, text } as never, NOW);
    }
    const text = await generator.generate(
      baseContext({ stage: ConversationStage.QUALIFICATION, conversation }),
    );
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toBe("Budget propertinya berapa kak? Beli cash atau KPR?");
  });

  it("UNIT_INFO with a matched listing → listing-found response", async () => {
    const text = await generator.generate(
      baseContext({ stage: ConversationStage.UNIT_INFO, matchedListings: [LISTING] }),
    );
    expect(text).toContain("Rumah Bintaro");
  });

  it("UNIT_INFO with no match → listing-not-found response", async () => {
    const text = await generator.generate(
      baseContext({ stage: ConversationStage.UNIT_INFO, requestedPropertyType: "RUMAH" }),
    );
    expect(text).toContain("RUMAH");
  });

  it("UNIT_INFO with no match and no requested property type → generic 'properti itu' wording", async () => {
    const text = await generator.generate(baseContext({ stage: ConversationStage.UNIT_INFO }));
    expect(text).toContain("properti itu");
  });

  it("PRICE_INFO with a matched listing → KPR info response", async () => {
    const text = await generator.generate(
      baseContext({ stage: ConversationStage.PRICE_INFO, matchedListings: [LISTING] }),
    );
    expect(text).toContain("DP");
  });

  it("PRICE_INFO with no match → asks which property", async () => {
    const text = await generator.generate(baseContext({ stage: ConversationStage.PRICE_INFO }));
    expect(text).toContain("DP/KPR");
  });

  it("OBJECTION → non-empty objection response", async () => {
    const text = await generator.generate(
      baseContext({ stage: ConversationStage.OBJECTION, messageText: "pikir dulu" }),
    );
    expect(text.length).toBeGreaterThan(0);
  });

  it("CLOSING → uses the score/attempt-driven closing pool", async () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      LeadScore.zero().apply(70),
    );
    const text = await generator.generate(
      baseContext({ stage: ConversationStage.CLOSING, conversation }),
    );
    expect(text.length).toBeGreaterThan(0);
  });

  it("HANDOFF → includes the sales name (defaults when not supplied)", async () => {
    const withName = await generator.generate(
      baseContext({ stage: ConversationStage.HANDOFF, salesName: "Sales Bintaro" }),
    );
    expect(withName).toContain("Sales Bintaro");
    const withoutName = await generator.generate(baseContext({ stage: ConversationStage.HANDOFF }));
    expect(withoutName).toContain("tim sales kita");
  });

  it("NURTURE → non-empty cold-nurture response", async () => {
    const text = await generator.generate(baseContext({ stage: ConversationStage.NURTURE }));
    expect(text.length).toBeGreaterThan(0);
  });

  it("CLOSED → non-empty closed response", async () => {
    const text = await generator.generate(baseContext({ stage: ConversationStage.CLOSED }));
    expect(text.length).toBeGreaterThan(0);
  });

  it("SYARIAH intent on an eligible stage overrides the normal reply", async () => {
    const text = await generator.generate(
      baseContext({
        stage: ConversationStage.DISCOVERY,
        intents: [PropertyDetectedIntent.SYARIAH],
        messageText: "ada opsi syariah?",
      }),
    );
    expect(text).toContain("syariah");
  });

  it("SYARIAH intent on CLOSING (not eligible) does NOT override", async () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      LeadScore.zero().apply(70),
    );
    const text = await generator.generate(
      baseContext({
        stage: ConversationStage.CLOSING,
        intents: [PropertyDetectedIntent.SYARIAH],
        conversation,
      }),
    );
    expect(text).not.toContain("syariah");
  });

  it("trims a response that exceeds the hard length ceiling at a sentence boundary", async () => {
    const longTitle =
      "Rumah Mewah Super Strategis di Pusat Kota dengan Halaman Luas dan Pemandangan Indah. " +
      "Lokasi sangat dekat dengan sekolah, rumah sakit, dan pusat perbelanjaan modern terbaik.";
    const longListing: PropertyListing = { ...LISTING, title: longTitle };
    const text = await generator.generate(
      baseContext({ stage: ConversationStage.UNIT_INFO, matchedListings: [longListing] }),
    );
    expect(text.length).toBeLessThanOrEqual(200);
  });

  it("falls back to a hard character cut when no sentence boundary exists early enough", async () => {
    const text = await generator.generate(
      baseContext({
        stage: ConversationStage.UNIT_INFO,
        requestedPropertyType: "x".repeat(250) as never,
      }),
    );
    expect(text.length).toBe(150);
  });

  it("every generated response stays within the length backstop", async () => {
    const text = await generator.generate(
      baseContext({ stage: ConversationStage.UNIT_INFO, matchedListings: [LISTING] }),
    );
    expect(text.length).toBeLessThanOrEqual(300);
  });
});
