import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { PropertyHandoffPackageBuilder } from "../../../src/builders/PropertyHandoffPackageBuilder.js";
import {
  ConversationMessage,
  MessageDirection,
} from "../../../src/domain/entities/ConversationMessage.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import type { PropertyListing } from "../../../src/domain/entities/PropertyListing.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { unwrap } from "../../helpers/result.js";

const NOW = new Date("2026-08-20T09:00:00.000Z");
const LISTING: PropertyListing = {
  id: "l1",
  title: "Rumah Bintaro",
  propertyType: "RUMAH",
  price: 1_500_000_000,
};

describe("PropertyHandoffPackageBuilder", () => {
  it("builds a package whose summary mentions the branch", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      unwrap(LeadScore.create(100)),
    );
    const pkg = PropertyHandoffPackageBuilder.build(conversation, [LISTING]);
    expect(pkg.conversationSummary).toContain("Mobix Cinere");
    expect(pkg.conversationSummary).toContain("Hubungi sekarang");
  });

  it("recommendedAction is 'siap survey lokasi' when score >= 90", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      unwrap(LeadScore.create(95)),
    );
    expect(PropertyHandoffPackageBuilder.build(conversation, []).recommendedAction).toContain(
      "survey lokasi",
    );
  });

  it("recommendedAction is a generic 'hubungi secepatnya' below 90", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      unwrap(LeadScore.create(70)),
    );
    expect(PropertyHandoffPackageBuilder.build(conversation, []).recommendedAction).toContain(
      "HOT",
    );
  });

  it("conversationHighlights includes the last 3 inbound messages only", () => {
    let conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    for (const text of ["satu", "dua", "tiga", "empat"]) {
      conversation = conversation.withAppendedMessage(
        unwrap(
          ConversationMessage.create({
            text,
            direction: MessageDirection.INBOUND,
            occurredAt: NOW,
          }),
        ),
        NOW,
      );
    }
    const pkg = PropertyHandoffPackageBuilder.build(conversation, []);
    expect(pkg.conversationHighlights).toEqual(["dua", "tiga", "empat"]);
  });

  it("matchedListings is passed through unchanged", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const pkg = PropertyHandoffPackageBuilder.build(conversation, [LISTING]);
    expect(pkg.matchedListings).toEqual([LISTING]);
  });

  it("qualifiedCriteria is empty since PROPERTY profile enrichment is out of scope", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const pkg = PropertyHandoffPackageBuilder.build(conversation, []);
    expect(pkg.qualifiedCriteria).toEqual([]);
  });
});
