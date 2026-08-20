import { BranchId } from "@aos/branch-manager";
import { beforeEach, describe, expect, it } from "vitest";

import type { IListingQueryService } from "../../../src/contracts/IListingQueryService.js";
import { PropertyConversationEngine } from "../../../src/conversation/PropertyConversationEngine.js";
import { PropertyResponseGenerator } from "../../../src/conversation/PropertyResponseGenerator.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import type { PropertyListing } from "../../../src/domain/entities/PropertyListing.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { ListingQuerier } from "../../../src/intelligence/ListingQuerier.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-08-20T09:00:00.000Z");
const THRESHOLDS = { warmThreshold: 30, hotThreshold: 65 };

const RUMAH_BINTARO: PropertyListing = {
  id: "l1",
  title: "Rumah Bintaro 3 Kamar",
  propertyType: "RUMAH",
  price: 1_500_000_000,
  city: "Tangerang Selatan",
  bedrooms: 3,
};
const VILLA_BANDUNG: PropertyListing = {
  id: "l2",
  title: "Villa Bandung",
  propertyType: "VILLA",
  price: 3_000_000_000,
  city: "Bandung",
  bedrooms: 4,
};

function withOneExchange(): LeadConversation {
  return LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
    .withAppendedMessage({ isInbound: true } as never, NOW)
    .withAppendedMessage({ isInbound: false } as never, NOW);
}

function fakeQueryService(active: ReadonlyArray<PropertyListing>): IListingQueryService {
  return { getActive: () => active };
}

describe("PropertyConversationEngine", () => {
  let engine: PropertyConversationEngine;

  beforeEach(() => {
    const querier = new ListingQuerier(fakeQueryService([RUMAH_BINTARO, VILLA_BANDUNG]));
    engine = new PropertyConversationEngine(
      querier,
      THRESHOLDS,
      new PropertyResponseGenerator(),
      () => "Sales Bintaro",
    );
  });

  it("GREETING stage → returns a greeting response", async () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const decision = unwrap(await engine.decide(conversation, "halo min"));
    expect(decision.nextStage).toBe(ConversationStage.GREETING);
    expect(decision.responseText.length).toBeGreaterThan(0);
  });

  it("asking for a rumah → queries real listings → returns a listing response with real data", async () => {
    const conversation = withOneExchange().withScore(LeadScore.zero().apply(25));
    const decision = unwrap(
      await engine.decide(conversation, "ada rumah gak di bawah 2 miliar kak?"),
    );
    expect(decision.nextStage).toBe(ConversationStage.UNIT_INFO);
    expect(decision.matchedListings).toHaveLength(1);
    expect(decision.responseText).toContain("Rumah Bintaro");
  });

  it("HESITATION → objection response", async () => {
    const conversation = withOneExchange();
    const decision = unwrap(await engine.decide(conversation, "pikir dulu ya kak"));
    expect(decision.nextStage).toBe(ConversationStage.OBJECTION);
  });

  it("score >= 65 → CLOSING response", async () => {
    const conversation = withOneExchange().withScore(LeadScore.zero().apply(70));
    const decision = unwrap(await engine.decide(conversation, "oke lanjut kak"));
    expect(decision.nextStage).toBe(ConversationStage.CLOSING);
  });

  it("listing not found for the requested type → suggests an alternative city that does have a match", async () => {
    const querier = new ListingQuerier(fakeQueryService([VILLA_BANDUNG]));
    const engineNoMatch = new PropertyConversationEngine(
      querier,
      THRESHOLDS,
      new PropertyResponseGenerator(),
      () => "Sales Bintaro",
    );
    const conversation = withOneExchange();
    const decision = unwrap(await engineNoMatch.decide(conversation, "ada ruko gak kak?"));
    expect(decision.matchedListings).toHaveLength(0);
    expect(decision.responseText.length).toBeGreaterThan(0);
  });

  it("a requested city with no match in that city → real alternative-city suggestion from a different city", async () => {
    const querier = new ListingQuerier(fakeQueryService([VILLA_BANDUNG]));
    const engineWithCity = new PropertyConversationEngine(
      querier,
      THRESHOLDS,
      new PropertyResponseGenerator(),
      () => "Sales Bintaro",
    );
    const conversation = withOneExchange();
    const decision = unwrap(
      await engineWithCity.decide(conversation, "ada villa di jakarta gak kak?"),
    );
    expect(decision.matchedListings).toHaveLength(0);
    expect(decision.responseText).toContain("Bandung");
  });

  it("extractMaxPriceIDR: 'juta'/'jt' amounts use the 1,000,000 multiplier, not the miliar one", async () => {
    const lowBudgetListing: PropertyListing = {
      id: "l3",
      title: "Rumah Murah",
      propertyType: "RUMAH",
      price: 400_000_000,
    };
    const querier = new ListingQuerier(fakeQueryService([lowBudgetListing, RUMAH_BINTARO]));
    const jutaEngine = new PropertyConversationEngine(
      querier,
      THRESHOLDS,
      new PropertyResponseGenerator(),
      () => "Sales Bintaro",
    );
    const decision = unwrap(
      await jutaEngine.decide(withOneExchange(), "ada rumah budget 500 juta kak?"),
    );
    expect(decision.matchedListings).toEqual([lowBudgetListing]);

    const jtDecision = unwrap(
      await jutaEngine.decide(withOneExchange(), "ada rumah budget 500 jt kak?"),
    );
    expect(jtDecision.matchedListings).toEqual([lowBudgetListing]);
  });

  it("extracts minBedrooms from the alternate 'kamar N' phrasing (not just 'N kamar')", async () => {
    const conversation = withOneExchange();
    const decision = unwrap(await engine.decide(conversation, "ada rumah kamar 3 dong kak"));
    expect(decision.matchedListings).toEqual([RUMAH_BINTARO]);
  });

  it("PRICE_INFO with a matched listing → includes KPR info", async () => {
    const conversation = withOneExchange().withScore(LeadScore.zero().apply(31));
    const decision = unwrap(await engine.decide(conversation, "dp rumah bintaro berapa kak?"));
    expect(decision.nextStage).toBe(ConversationStage.PRICE_INFO);
  });

  it("every generated response stays <= 300 characters", async () => {
    const scenarios: Array<[LeadConversation, string]> = [
      [LeadConversation.start("+62812", BranchId.CINERE, NOW), "halo min"],
      [withOneExchange(), "ada rumah bintaro?"],
      [withOneExchange().withScore(LeadScore.zero().apply(31)), "dp rumah berapa kak"],
      [withOneExchange(), "pikir dulu ah"],
      [withOneExchange().withScore(LeadScore.zero().apply(70)), "oke siap"],
    ];
    for (const [conversation, text] of scenarios) {
      const decision = unwrap(await engine.decide(conversation, text));
      expect(decision.responseText.length).toBeLessThanOrEqual(300);
    }
  });

  it("propagates an AgentError from ListingQuerier.findForLead", async () => {
    const throwingQuerier = new ListingQuerier({
      getActive: () => {
        throw new Error("store unavailable");
      },
    });
    const throwingEngine = new PropertyConversationEngine(
      throwingQuerier,
      THRESHOLDS,
      new PropertyResponseGenerator(),
      () => "Sales Bintaro",
    );
    const conversation = withOneExchange();
    const result = await throwingEngine.decide(conversation, "ada rumah gak kak?");
    expect(unwrapErr(result).message).toContain("ListingQuerier.findForLead failed");
  });

  it("an alternative listing with no matching propertyType leaves alternativeCity undefined", async () => {
    const querier = new ListingQuerier(fakeQueryService([]));
    const emptyEngine = new PropertyConversationEngine(
      querier,
      THRESHOLDS,
      new PropertyResponseGenerator(),
      () => "Sales Bintaro",
    );
    const conversation = withOneExchange();
    const decision = unwrap(await emptyEngine.decide(conversation, "ada rumah gak kak?"));
    expect(decision.matchedListings).toHaveLength(0);
    expect(decision.responseText).not.toContain("tapi di");
  });
});
