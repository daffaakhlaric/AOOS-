import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import {
  ConversationMessage,
  MessageDirection,
} from "../../../../src/domain/entities/ConversationMessage.js";
import { LeadConversation } from "../../../../src/domain/entities/LeadConversation.js";
import { LeadProfile } from "../../../../src/domain/entities/LeadProfile.js";
import { ConversationStage } from "../../../../src/domain/value-objects/ConversationStage.js";
import { LeadScore } from "../../../../src/domain/value-objects/LeadScore.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

function inboundMessage(text: string, at: Date = NOW): ConversationMessage {
  return unwrap(
    ConversationMessage.create({ text, direction: MessageDirection.INBOUND, occurredAt: at }),
  );
}

describe("LeadConversation", () => {
  it("start() begins at GREETING with score 0 and no messages", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    expect(conversation.stage).toBe(ConversationStage.GREETING);
    expect(conversation.score.toNumber()).toBe(0);
    expect(conversation.messages).toHaveLength(0);
    expect(conversation.closed).toBe(false);
    expect(conversation.leadPhone).toBe("+6281200000001");
    expect(conversation.branchId).toBe(BranchId.CINERE);
    expect(conversation.startedAt).toBe(NOW);
    expect(conversation.lastMessageAt).toBe(NOW);
  });

  it("withAppendedMessage() appends and advances lastMessageAt", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const later = new Date(NOW.getTime() + 1000);
    const updated = conversation.withAppendedMessage(inboundMessage("halo"), later);
    expect(updated.messages).toHaveLength(1);
    expect(updated.lastMessageAt).toBe(later);
  });

  it("inboundMessageCount counts only INBOUND messages", () => {
    const outbound = unwrap(
      ConversationMessage.create({
        text: "Hai kak!",
        direction: MessageDirection.OUTBOUND,
        occurredAt: NOW,
      }),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW)
      .withAppendedMessage(inboundMessage("halo"), NOW)
      .withAppendedMessage(outbound, NOW)
      .withAppendedMessage(inboundMessage("ada xpander?"), NOW);
    expect(conversation.inboundMessageCount).toBe(2);
  });

  it("withStage()/withScore()/withProfile()/withClosed() each return a NEW instance", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const staged = conversation.withStage(ConversationStage.DISCOVERY);
    const scored = conversation.withScore(unwrap(LeadScore.create(25)));
    const profiled = conversation.withProfile(LeadProfile.empty().withEnrichment({ name: "Budi" }));
    const closed = conversation.withClosed(true);

    expect(conversation.stage).toBe(ConversationStage.GREETING);
    expect(staged.stage).toBe(ConversationStage.DISCOVERY);
    expect(conversation.score.toNumber()).toBe(0);
    expect(scored.score.toNumber()).toBe(25);
    expect(conversation.profile.name).toBeUndefined();
    expect(profiled.profile.name).toBe("Budi");
    expect(conversation.closed).toBe(false);
    expect(closed.closed).toBe(true);
  });

  it("isStale() is false before the timeout elapses", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const almostTimedOut = new Date(NOW.getTime() + 1000);
    expect(conversation.isStale(21_600_000, almostTimedOut)).toBe(false);
  });

  it("isStale() is true once the timeout has elapsed", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const timedOut = new Date(NOW.getTime() + 21_600_000);
    expect(conversation.isStale(21_600_000, timedOut)).toBe(true);
  });

  it("create() rejects an empty leadPhone", () => {
    const result = LeadConversation.create({
      id: LeadConversation.start("x", BranchId.CINERE, NOW).id,
      leadPhone: "",
      branchId: BranchId.CINERE,
      stage: ConversationStage.GREETING,
      score: LeadScore.zero(),
      profile: LeadProfile.empty(),
      messages: [],
      startedAt: NOW,
      lastMessageAt: NOW,
      closed: false,
    });
    expect(unwrapErr(result).message).toContain("non-empty");
  });

  it("create() rejects an invalid stage", () => {
    const result = LeadConversation.create({
      id: LeadConversation.start("x", BranchId.CINERE, NOW).id,
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      stage: "NOT_A_STAGE" as ConversationStage,
      score: LeadScore.zero(),
      profile: LeadProfile.empty(),
      messages: [],
      startedAt: NOW,
      lastMessageAt: NOW,
      closed: false,
    });
    expect(unwrapErr(result).message).toContain("ConversationStage");
  });

  it("create() accepts a valid conversation and defensively copies messages", () => {
    const messages = [inboundMessage("halo")];
    const conversation = unwrap(
      LeadConversation.create({
        id: LeadConversation.start("x", BranchId.CINERE, NOW).id,
        leadPhone: "+6281200000001",
        branchId: BranchId.CINERE,
        stage: ConversationStage.GREETING,
        score: LeadScore.zero(),
        profile: LeadProfile.empty(),
        messages,
        startedAt: NOW,
        lastMessageAt: NOW,
        closed: false,
      }),
    );
    messages.push(inboundMessage("dua"));
    expect(conversation.messages).toHaveLength(1);
  });
});
