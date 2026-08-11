import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { Conversation } from "../../../src/domain/entities/Conversation.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { MessageId } from "../../../src/domain/value-objects/MessageId.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  const leadPhone = unwrap(PhoneNumber.create("+628123456789"));
  const wabaPhoneNumberId = unwrap(PhoneNumberId.create("100000000000001"));
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: ConversationId.fromParticipants(leadPhone, wabaPhoneNumberId),
    leadPhone,
    wabaPhoneNumberId,
    branch: Branch.BINTARO,
    messages: [] as MessageId[],
    startedAt,
    lastMessageAt: startedAt,
    messageCount: 0,
    status: "ACTIVE" as const,
  };
}

describe("Conversation", () => {
  it("creates with zero messages and exposes all getters", () => {
    const props = baseProps();
    const conversation = unwrap(Conversation.create(props));
    expect(conversation.messages).toEqual([]);
    expect(conversation.messageCount).toBe(0);
    expect(conversation.status).toBe("ACTIVE");
    expect(conversation.leadPhone.equals(props.leadPhone)).toBe(true);
    expect(conversation.wabaPhoneNumberId.equals(props.wabaPhoneNumberId)).toBe(true);
    expect(conversation.branch).toBe(Branch.BINTARO);
    expect(conversation.startedAt).toEqual(props.startedAt);
  });

  it("rejects a messageCount that doesn't match messages.length", () => {
    const error = unwrapErr(Conversation.create({ ...baseProps(), messageCount: 5 }));
    expect(error.message).toContain("messageCount");
  });

  it("rejects an invalid status", () => {
    const error = unwrapErr(
      Conversation.create({ ...baseProps(), status: "BOGUS" as unknown as "ACTIVE" }),
    );
    expect(error.message).toContain("status");
  });

  it("withNewMessage appends a message and advances lastMessageAt on a NEW instance", () => {
    const conversation = unwrap(Conversation.create(baseProps()));
    const messageId = MessageId.generate();
    const at = new Date("2026-01-02T00:00:00.000Z");

    const updated = conversation.withNewMessage(messageId, at);

    expect(updated).not.toBe(conversation);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0]?.equals(messageId)).toBe(true);
    expect(updated.messageCount).toBe(1);
    expect(updated.lastMessageAt).toEqual(at);
    expect(conversation.messages).toHaveLength(0);
  });
});
