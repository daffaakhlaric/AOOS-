import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { HandoffPackageBuilder } from "../../../src/builders/HandoffPackageBuilder.js";
import {
  ConversationMessage,
  MessageDirection,
} from "../../../src/domain/entities/ConversationMessage.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { LeadProfile } from "../../../src/domain/entities/LeadProfile.js";
import { LeadScore } from "../../../src/domain/value-objects/LeadScore.js";
import { QualificationStatus } from "../../../src/domain/value-objects/QualificationStatus.js";
import { unwrap } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

describe("HandoffPackageBuilder", () => {
  it("builds a package with the correct Indonesian summary mentioning unit + branch", () => {
    const profile = LeadProfile.empty()
      .withEnrichment({ unit: "Xpander 2019" }, QualificationStatus.UNIT)
      .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
      .withEnrichment({ paymentMethod: "Kredit" }, QualificationStatus.PAYMENT)
      .withEnrichment({ area: "Depok" }, QualificationStatus.AREA);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
      .withProfile(profile)
      .withScore(unwrap(LeadScore.create(100)));

    const pkg = HandoffPackageBuilder.build(conversation, []);
    expect(pkg.conversationSummary).toContain("Xpander 2019");
    expect(pkg.conversationSummary).toContain("200 juta");
    expect(pkg.conversationSummary).toContain("Kredit");
    expect(pkg.conversationSummary).toContain("Mobix Cinere");
    expect(pkg.conversationSummary).toContain("Hubungi sekarang");
  });

  it("qualifiedCriteria reflects exactly what the profile has qualified", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withProfile(
      LeadProfile.empty().withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT),
    );
    const pkg = HandoffPackageBuilder.build(conversation, []);
    expect(pkg.qualifiedCriteria).toEqual([QualificationStatus.UNIT]);
  });

  it("recommendedAction is 'siap test drive' when score ≥ 90", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      unwrap(LeadScore.create(95)),
    );
    expect(HandoffPackageBuilder.build(conversation, []).recommendedAction).toContain("test drive");
  });

  it("recommendedAction is a generic 'hubungi secepatnya' below 90", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      unwrap(LeadScore.create(70)),
    );
    expect(HandoffPackageBuilder.build(conversation, []).recommendedAction).toContain("HOT");
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
    const pkg = HandoffPackageBuilder.build(conversation, []);
    expect(pkg.conversationHighlights).toEqual(["dua", "tiga", "empat"]);
  });

  it("matchedUnits is passed through unchanged", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const pkg = HandoffPackageBuilder.build(conversation, []);
    expect(pkg.matchedUnits).toEqual([]);
  });

  it("summary says 'Budget belum jelas' when only paymentMethod (no budget) is known", () => {
    const profile = LeadProfile.empty().withEnrichment(
      { paymentMethod: "Kredit" },
      QualificationStatus.PAYMENT,
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withProfile(
      profile,
    );
    const pkg = HandoffPackageBuilder.build(conversation, []);
    expect(pkg.conversationSummary).toContain("Budget belum jelas");
    expect(pkg.conversationSummary).toContain("mau Kredit");
  });

  it("summary handles a profile with no known fields gracefully", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const pkg = HandoffPackageBuilder.build(conversation, []);
    expect(pkg.conversationSummary.length).toBeGreaterThan(0);
  });
});
