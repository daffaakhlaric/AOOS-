import { BranchId } from "@aos/branch-manager";
import { ok, err } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import type { IPropertyConversationEngine } from "../../../src/contracts/IPropertyConversationEngine.js";
import type { IPropertyLeadScorer } from "../../../src/contracts/IPropertyLeadScorer.js";
import { PropertyConversationPipeline } from "../../../src/conversation/PropertyConversationPipeline.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { AgentError } from "../../../src/domain/errors/AgentError.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { PropertyScoreDelta } from "../../../src/domain/value-objects/PropertyScoreDelta.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-08-20T09:00:00.000Z");

function fakeScorer(deltas: PropertyScoreDelta[] = []): IPropertyLeadScorer {
  return { score: vi.fn(() => deltas) };
}

function fakeEngine(
  responseText: string,
  nextStage: ConversationStage = ConversationStage.DISCOVERY,
): IPropertyConversationEngine {
  return {
    decide: vi.fn(async () => ok({ nextStage, responseText, matchedListings: [] })),
  };
}

describe("PropertyConversationPipeline", () => {
  it("appends the inbound message and the outbound reply", async () => {
    const pipeline = new PropertyConversationPipeline(fakeScorer(), fakeEngine("Hai kak!"));
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "halo", NOW));
    expect(result.conversation.messages).toHaveLength(2);
    expect(result.responseText).toBe("Hai kak!");
  });

  it("applies every scoring delta, clamped via LeadScore.apply", async () => {
    const pipeline = new PropertyConversationPipeline(
      fakeScorer([PropertyScoreDelta.of("BUDGET", 20), PropertyScoreDelta.of("AREA", 20)]),
      fakeEngine("ok"),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(
      await pipeline.process(conversation, "budget 1.5 miliar di bintaro", NOW),
    );
    expect(result.conversation.score.toNumber()).toBe(40);
    expect(result.appliedDeltas).toHaveLength(2);
  });

  it("moves the conversation to the engine's decided stage", async () => {
    const pipeline = new PropertyConversationPipeline(
      fakeScorer(),
      fakeEngine("ok", ConversationStage.UNIT_INFO),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "ada rumah?", NOW));
    expect(result.conversation.stage).toBe(ConversationStage.UNIT_INFO);
  });

  it("propagates an engine error", async () => {
    const engine: IPropertyConversationEngine = {
      decide: vi.fn(async () => err(new AgentError("INTERNAL" as never, "engine failed"))),
    };
    const pipeline = new PropertyConversationPipeline(fakeScorer(), engine);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = await pipeline.process(conversation, "halo", NOW);
    expect(unwrapErr(result).message).toBe("engine failed");
  });

  it("rejects an empty message text", async () => {
    const pipeline = new PropertyConversationPipeline(fakeScorer(), fakeEngine("ok"));
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = await pipeline.process(conversation, "", NOW);
    expect(unwrapErr(result).message).toContain("non-empty");
  });

  it("returns matchedListings from the engine's decision", async () => {
    const engine: IPropertyConversationEngine = {
      decide: vi.fn(async () =>
        ok({ nextStage: ConversationStage.UNIT_INFO, responseText: "ok", matchedListings: [] }),
      ),
    };
    const pipeline = new PropertyConversationPipeline(fakeScorer(), engine);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "ada rumah?", NOW));
    expect(result.matchedListings).toEqual([]);
  });

  it("engine decides CLOSING → resulting conversation has closingAttemptCount incremented to 1", async () => {
    const pipeline = new PropertyConversationPipeline(
      fakeScorer(),
      fakeEngine("ok", ConversationStage.CLOSING),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "oke deh", NOW));
    expect(result.conversation.closingAttemptCount).toBe(1);
  });

  it("two consecutive CLOSING decisions increment closingAttemptCount to 2", async () => {
    const pipeline = new PropertyConversationPipeline(
      fakeScorer(),
      fakeEngine("ok", ConversationStage.CLOSING),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const first = unwrap(await pipeline.process(conversation, "oke deh", NOW));
    const second = unwrap(await pipeline.process(first.conversation, "gimana", NOW));
    expect(second.conversation.closingAttemptCount).toBe(2);
  });

  it("a non-CLOSING decision does not touch closingAttemptCount", async () => {
    const pipeline = new PropertyConversationPipeline(
      fakeScorer(),
      fakeEngine("ok", ConversationStage.DISCOVERY),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "halo", NOW));
    expect(result.conversation.closingAttemptCount).toBe(0);
  });
});
