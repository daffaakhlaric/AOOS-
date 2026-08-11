import { BranchId } from "@aos/branch-manager";
import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import type { IConversationEngine } from "../../../src/contracts/IConversationEngine.js";
import type { ILeadScorer } from "../../../src/contracts/ILeadScorer.js";
import { ConversationPipeline } from "../../../src/conversation/ConversationPipeline.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { LeadProfile } from "../../../src/domain/entities/LeadProfile.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { QualificationStatus } from "../../../src/domain/value-objects/QualificationStatus.js";
import { unwrap } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function fakeScorer(): ILeadScorer {
  return { score: vi.fn(() => []) };
}

function fakeEngine(nextStage: ConversationStage, responseText = "ok"): IConversationEngine {
  return { decide: vi.fn(async () => ok({ nextStage, responseText, matchedUnits: [] })) };
}

describe("ConversationPipeline — closing/qualification tracking (AAOS-W3D)", () => {
  it("engine decides CLOSING → resulting conversation has closingAttemptCount incremented to 1", async () => {
    const pipeline = new ConversationPipeline(fakeScorer(), fakeEngine(ConversationStage.CLOSING));
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "oke deh", NOW));
    expect(result.conversation.closingAttemptCount).toBe(1);
  });

  it("two consecutive CLOSING decisions increment closingAttemptCount to 2", async () => {
    const pipeline = new ConversationPipeline(fakeScorer(), fakeEngine(ConversationStage.CLOSING));
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const first = unwrap(await pipeline.process(conversation, "oke deh", NOW));
    const second = unwrap(await pipeline.process(first.conversation, "gimana", NOW));
    expect(second.conversation.closingAttemptCount).toBe(2);
  });

  it("a non-CLOSING decision does not touch closingAttemptCount", async () => {
    const pipeline = new ConversationPipeline(
      fakeScorer(),
      fakeEngine(ConversationStage.DISCOVERY),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "halo", NOW));
    expect(result.conversation.closingAttemptCount).toBe(0);
  });

  it("engine decides QUALIFICATION with nothing extracted → askedCriteria records BUDGET", async () => {
    const pipeline = new ConversationPipeline(
      fakeScorer(),
      fakeEngine(ConversationStage.QUALIFICATION),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "oke kak", NOW));
    expect(result.conversation.askedCriteria.has(QualificationStatus.BUDGET)).toBe(true);
  });

  it("engine decides QUALIFICATION with BUDGET already extracted → askedCriteria records UNIT next", async () => {
    const pipeline = new ConversationPipeline(
      fakeScorer(),
      fakeEngine(ConversationStage.QUALIFICATION),
    );
    const profile = LeadProfile.empty().withEnrichment(
      { budget: "200 juta" },
      QualificationStatus.BUDGET,
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withProfile(
      profile,
    );
    const result = unwrap(await pipeline.process(conversation, "oke kak", NOW));
    expect(result.conversation.askedCriteria.has(QualificationStatus.UNIT)).toBe(true);
    expect(result.conversation.askedCriteria.has(QualificationStatus.BUDGET)).toBe(false);
  });

  it("engine decides QUALIFICATION with all 4 core criteria already extracted → askedCriteria stays empty", async () => {
    const pipeline = new ConversationPipeline(
      fakeScorer(),
      fakeEngine(ConversationStage.QUALIFICATION),
    );
    const profile = LeadProfile.empty()
      .withEnrichment({ budget: "200 juta" }, QualificationStatus.BUDGET)
      .withEnrichment({ unit: "Xpander" }, QualificationStatus.UNIT)
      .withEnrichment({ area: "Cinere" }, QualificationStatus.AREA)
      .withEnrichment({ paymentMethod: "Cash" }, QualificationStatus.PAYMENT);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withProfile(
      profile,
    );
    const result = unwrap(await pipeline.process(conversation, "oke kak", NOW));
    expect(result.conversation.askedCriteria.size).toBe(0);
  });

  it("a non-QUALIFICATION decision does not touch askedCriteria", async () => {
    const pipeline = new ConversationPipeline(
      fakeScorer(),
      fakeEngine(ConversationStage.DISCOVERY),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "halo", NOW));
    expect(result.conversation.askedCriteria.size).toBe(0);
  });

  it("previously-asked criteria persist across turns and are never re-asked", async () => {
    const pipeline = new ConversationPipeline(
      fakeScorer(),
      fakeEngine(ConversationStage.QUALIFICATION),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const first = unwrap(await pipeline.process(conversation, "oke kak", NOW));
    expect(first.conversation.askedCriteria.has(QualificationStatus.BUDGET)).toBe(true);
    const second = unwrap(await pipeline.process(first.conversation, "oke kak lagi", NOW));
    expect(second.conversation.askedCriteria.has(QualificationStatus.UNIT)).toBe(true);
    expect(second.conversation.askedCriteria.size).toBe(2);
  });
});
