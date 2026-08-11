import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ConversationMapper } from "../../../src/infrastructure/mappers/ConversationMapper.js";
import { makeConversationRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ConversationMapper.toDomain", () => {
  it("maps every field exactly, 1:1", () => {
    const row = makeConversationRow({
      branch_id: BranchId.BANDUNG,
      waba_phone_number_id: "waba-bandung-1",
      message_count: 6,
      incoming_count: 3,
      outgoing_count: 3,
      d1_count: 1,
      d2_count: 1,
      d3_count: 1,
      d5_count: 0,
      current_stage: "QUALIFYING",
      last_intent: "ask_budget",
      started_at: "2026-01-14T07:00:00.000Z",
      last_message_at: "2026-01-15T09:00:00.000Z",
      status: "ACTIVE",
    });

    const conversation = unwrap(ConversationMapper.toDomain(row));

    expect(conversation.id.toString()).toBe(row.id);
    expect(conversation.leadId.toString()).toBe(row.lead_id);
    expect(conversation.branchId).toBe(BranchId.BANDUNG);
    expect(conversation.wabaPhoneNumberId.toString()).toBe("waba-bandung-1");
    expect(conversation.messageCount).toBe(6);
    expect(conversation.incomingCount).toBe(3);
    expect(conversation.outgoingCount).toBe(3);
    expect(conversation.milestones).toEqual({ d1: 1, d2: 1, d3: 1, d5: 0 });
    expect(conversation.currentStage).toBe("QUALIFYING");
    expect(conversation.lastIntent).toBe("ask_budget");
    expect(conversation.startedAt.toISOString()).toBe("2026-01-14T07:00:00.000Z");
    expect(conversation.lastMessageAt.toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(conversation.status).toBe("ACTIVE");
  });

  it("maps null last_intent to undefined", () => {
    const conversation = unwrap(
      ConversationMapper.toDomain(makeConversationRow({ last_intent: null })),
    );
    expect(conversation.lastIntent).toBeUndefined();
  });

  it("fails on an invalid id", () => {
    const error = unwrapErr(ConversationMapper.toDomain(makeConversationRow({ id: "" })));
    expect(error.message).toContain("ConversationId");
  });

  it("fails on an invalid lead_id", () => {
    const error = unwrapErr(ConversationMapper.toDomain(makeConversationRow({ lead_id: "" })));
    expect(error.message).toContain("LeadId");
  });

  it("fails on an invalid waba_phone_number_id", () => {
    const error = unwrapErr(
      ConversationMapper.toDomain(makeConversationRow({ waba_phone_number_id: "" })),
    );
    expect(error.message).toContain("PhoneNumberId");
  });

  it("fails on an invalid branch_id", () => {
    const error = unwrapErr(
      ConversationMapper.toDomain(makeConversationRow({ branch_id: "MARS" })),
    );
    expect(error.message).toContain("branch_id");
  });

  it("fails on an invalid status", () => {
    const error = unwrapErr(ConversationMapper.toDomain(makeConversationRow({ status: "PAUSED" })));
    expect(error.message).toContain("status");
  });

  it("fails when message_count is negative (Conversation entity validation)", () => {
    const error = unwrapErr(
      ConversationMapper.toDomain(makeConversationRow({ message_count: -1 })),
    );
    expect(error.message).toContain("messageCount");
  });
});

describe("ConversationMapper.toRow", () => {
  it("round-trips every field exactly", () => {
    const row = makeConversationRow({ last_intent: "ask_area", d1_count: 1, d2_count: 1 });
    const conversation = unwrap(ConversationMapper.toDomain(row));
    expect(ConversationMapper.toRow(conversation)).toEqual(row);
  });

  it("maps undefined lastIntent to null", () => {
    const conversation = unwrap(
      ConversationMapper.toDomain(makeConversationRow({ last_intent: null })),
    );
    expect(ConversationMapper.toRow(conversation).last_intent).toBeNull();
  });
});
