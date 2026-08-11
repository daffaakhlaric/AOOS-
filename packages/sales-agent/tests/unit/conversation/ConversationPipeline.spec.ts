import { BranchId } from "@aos/branch-manager";
import { ok, err } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import type { IConversationEngine } from "../../../src/contracts/IConversationEngine.js";
import type { ILeadScorer } from "../../../src/contracts/ILeadScorer.js";
import { ConversationPipeline } from "../../../src/conversation/ConversationPipeline.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { AgentError } from "../../../src/domain/errors/AgentError.js";
import { ConversationStage } from "../../../src/domain/value-objects/ConversationStage.js";
import { ScoreDelta } from "../../../src/domain/value-objects/ScoreDelta.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function fakeScorer(deltas: ScoreDelta[]): ILeadScorer {
  return { score: vi.fn(() => deltas) };
}

function fakeEngine(
  responseText: string,
  nextStage: ConversationStage = ConversationStage.DISCOVERY,
): IConversationEngine {
  return {
    decide: vi.fn(async () => ok({ nextStage, responseText, matchedUnits: [] })),
  };
}

describe("ConversationPipeline", () => {
  it("appends the inbound message and the outbound reply", async () => {
    const pipeline = new ConversationPipeline(fakeScorer([]), fakeEngine("Hai kak!"));
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "halo", NOW));
    expect(result.conversation.messages).toHaveLength(2);
    expect(result.responseText).toBe("Hai kak!");
  });

  it("applies every scoring delta, clamped via LeadScore.apply", async () => {
    const pipeline = new ConversationPipeline(
      fakeScorer([ScoreDelta.of("BUDGET", 25), ScoreDelta.of("UNIT", 25)]),
      fakeEngine("ok"),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "budget 200 juta xpander", NOW));
    expect(result.conversation.score.toNumber()).toBe(50);
    expect(result.appliedDeltas).toHaveLength(2);
  });

  it("enriches the profile via QualificationDetector", async () => {
    const pipeline = new ConversationPipeline(fakeScorer([]), fakeEngine("ok"));
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "nama saya Budi", NOW));
    expect(result.conversation.profile.name).toBe("Budi");
  });

  it("moves the conversation to the engine's decided stage", async () => {
    const pipeline = new ConversationPipeline(
      fakeScorer([]),
      fakeEngine("ok", ConversationStage.UNIT_INFO),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "ada xpander?", NOW));
    expect(result.conversation.stage).toBe(ConversationStage.UNIT_INFO);
  });

  it("propagates an engine error", async () => {
    const engine: IConversationEngine = {
      decide: vi.fn(async () => err(new AgentError("INTERNAL" as never, "engine failed"))),
    };
    const pipeline = new ConversationPipeline(fakeScorer([]), engine);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = await pipeline.process(conversation, "halo", NOW);
    expect(unwrapErr(result).message).toBe("engine failed");
  });

  it("rejects an empty message text", async () => {
    const pipeline = new ConversationPipeline(fakeScorer([]), fakeEngine("ok"));
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = await pipeline.process(conversation, "", NOW);
    expect(unwrapErr(result).message).toContain("non-empty");
  });

  it("returns matchedUnits from the engine's decision", async () => {
    const engine: IConversationEngine = {
      decide: vi.fn(async () =>
        ok({ nextStage: ConversationStage.UNIT_INFO, responseText: "ok", matchedUnits: [] }),
      ),
    };
    const pipeline = new ConversationPipeline(fakeScorer([]), engine);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const result = unwrap(await pipeline.process(conversation, "ada xpander?", NOW));
    expect(result.matchedUnits).toEqual([]);
  });
});
