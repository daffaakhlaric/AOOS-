import { BranchId } from "@aos/branch-manager";
import { PhoneNumberId } from "@aos/whatsapp-connector";
import { describe, expect, it } from "vitest";

import { Conversation } from "../../../src/domain/entities/Conversation.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-01-15T09:00:00.000Z");
const LATER = new Date("2026-01-15T10:00:00.000Z");

function baseProps() {
  return {
    id: ConversationId.generate(),
    leadId: LeadId.generate(),
    branchId: BranchId.BINTARO,
    wabaPhoneNumberId: unwrap(PhoneNumberId.create("waba-1")),
    messageCount: 0,
    incomingCount: 0,
    outgoingCount: 0,
    milestones: { d1: 0 as const, d2: 0 as const, d3: 0 as const, d5: 0 as const },
    currentStage: "GREETING",
    startedAt: NOW,
    lastMessageAt: NOW,
    status: "ACTIVE" as const,
  };
}

describe("Conversation entity", () => {
  it("creates a valid conversation", () => {
    const conversation = unwrap(Conversation.create(baseProps()));
    expect(conversation.messageCount).toBe(0);
    expect(conversation.status).toBe("ACTIVE");
  });

  it("rejects a negative messageCount", () => {
    const error = unwrapErr(Conversation.create({ ...baseProps(), messageCount: -1 }));
    expect(error.message).toContain("messageCount");
  });

  it("recordMessage increments messageCount and incomingCount for INCOMING", () => {
    const conversation = unwrap(Conversation.create(baseProps()));
    const updated = conversation.recordMessage("INCOMING", { d1: 0, d2: 0, d3: 0, d5: 0 }, LATER);
    expect(updated.messageCount).toBe(1);
    expect(updated.incomingCount).toBe(1);
    expect(updated.outgoingCount).toBe(0);
    expect(updated.lastMessageAt).toBe(LATER);
  });

  it("recordMessage increments outgoingCount for OUTGOING", () => {
    const conversation = unwrap(Conversation.create(baseProps()));
    const updated = conversation.recordMessage("OUTGOING", { d1: 0, d2: 0, d3: 0, d5: 0 }, LATER);
    expect(updated.outgoingCount).toBe(1);
    expect(updated.incomingCount).toBe(0);
  });

  it("recordMessage replaces the milestones snapshot", () => {
    const conversation = unwrap(Conversation.create(baseProps()));
    const updated = conversation.recordMessage("OUTGOING", { d1: 1, d2: 0, d3: 0, d5: 0 }, LATER);
    expect(updated.milestones).toEqual({ d1: 1, d2: 0, d3: 0, d5: 0 });
  });

  it("withStage updates currentStage and optionally lastIntent", () => {
    const conversation = unwrap(Conversation.create(baseProps()));
    const updated = conversation.withStage("QUALIFYING", "ask_budget");
    expect(updated.currentStage).toBe("QUALIFYING");
    expect(updated.lastIntent).toBe("ask_budget");
  });

  it("withStage preserves lastIntent when not passed", () => {
    const conversation = unwrap(Conversation.create({ ...baseProps(), lastIntent: "greeting" }));
    const updated = conversation.withStage("QUALIFYING");
    expect(updated.lastIntent).toBe("greeting");
  });

  it("withStatus updates status", () => {
    const conversation = unwrap(Conversation.create(baseProps()));
    const updated = conversation.withStatus("CLOSED");
    expect(updated.status).toBe("CLOSED");
  });

  it("exposes every getter matching the constructed props", () => {
    const props = baseProps();
    const conversation = unwrap(Conversation.create(props));
    expect(conversation.id).toBe(props.id);
    expect(conversation.leadId).toBe(props.leadId);
    expect(conversation.branchId).toBe(BranchId.BINTARO);
    expect(conversation.startedAt).toBe(NOW);
  });
});
