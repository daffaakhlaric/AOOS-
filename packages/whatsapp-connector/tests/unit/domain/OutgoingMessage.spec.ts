import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { OutgoingMessage } from "../../../src/domain/entities/OutgoingMessage.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { MessageBody } from "../../../src/domain/value-objects/MessageBody.js";
import { MessageId } from "../../../src/domain/value-objects/MessageId.js";
import { MessageStatus } from "../../../src/domain/value-objects/MessageStatus.js";
import { MessageType } from "../../../src/domain/value-objects/MessageType.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  const to = unwrap(PhoneNumber.create("+628123456789"));
  const from = unwrap(PhoneNumberId.create("100000000000001"));
  return {
    id: MessageId.generate(),
    to,
    from,
    branch: Branch.BINTARO,
    conversationId: ConversationId.fromParticipants(to, from),
    type: MessageType.TEXT,
    body: unwrap(MessageBody.create("Halo")),
    status: MessageStatus.SENT,
  };
}

describe("OutgoingMessage", () => {
  it("creates with valid props and exposes all getters", () => {
    const props = baseProps();
    const message = unwrap(OutgoingMessage.create(props));
    expect(message.id.equals(props.id)).toBe(true);
    expect(message.to.equals(props.to)).toBe(true);
    expect(message.from.equals(props.from)).toBe(true);
    expect(message.branch).toBe(Branch.BINTARO);
    expect(message.type).toBe(MessageType.TEXT);
    expect(message.body.toString()).toBe("Halo");
    expect(message.status).toBe(MessageStatus.SENT);
    expect(message.sentAt).toBeUndefined();
    expect(message.deliveredAt).toBeUndefined();
    expect(message.readAt).toBeUndefined();
  });

  it("rejects an invalid type", () => {
    const error = unwrapErr(
      OutgoingMessage.create({ ...baseProps(), type: "BOGUS" as unknown as MessageType }),
    );
    expect(error.message).toContain("type");
  });

  it("rejects an invalid status", () => {
    const error = unwrapErr(
      OutgoingMessage.create({ ...baseProps(), status: "BOGUS" as unknown as MessageStatus }),
    );
    expect(error.message).toContain("status");
  });

  it("withConfirmedSend returns a NEW instance with the confirmed id/status/sentAt (never mutates the original — see engineering report resolution #4)", () => {
    const preliminary = unwrap(OutgoingMessage.create(baseProps()));
    const confirmedId = unwrap(MessageId.create("wamid.real123"));
    const sentAt = new Date("2026-01-01T00:00:00.000Z");

    const confirmed = preliminary.withConfirmedSend(confirmedId, sentAt);

    expect(confirmed).not.toBe(preliminary);
    expect(confirmed.id.equals(confirmedId)).toBe(true);
    expect(confirmed.status).toBe(MessageStatus.SENT);
    expect(confirmed.sentAt).toEqual(sentAt);
    // The original preliminary instance is untouched.
    expect(preliminary.sentAt).toBeUndefined();
    expect(preliminary.id.equals(confirmedId)).toBe(false);
  });

  it("withStatus(DELIVERED) sets deliveredAt on a NEW instance", () => {
    const message = unwrap(OutgoingMessage.create(baseProps()));
    const at = new Date("2026-01-02T00:00:00.000Z");
    const delivered = message.withStatus(MessageStatus.DELIVERED, at);
    expect(delivered.status).toBe(MessageStatus.DELIVERED);
    expect(delivered.deliveredAt).toEqual(at);
    expect(message.deliveredAt).toBeUndefined();
  });

  it("withStatus(READ) sets readAt on a NEW instance", () => {
    const message = unwrap(OutgoingMessage.create(baseProps()));
    const at = new Date("2026-01-03T00:00:00.000Z");
    const read = message.withStatus(MessageStatus.READ, at);
    expect(read.status).toBe(MessageStatus.READ);
    expect(read.readAt).toEqual(at);
  });

  it("withStatus(FAILED) transitions status without setting deliveredAt/readAt", () => {
    const message = unwrap(OutgoingMessage.create(baseProps()));
    const failed = message.withStatus(MessageStatus.FAILED, new Date());
    expect(failed.status).toBe(MessageStatus.FAILED);
    expect(failed.deliveredAt).toBeUndefined();
    expect(failed.readAt).toBeUndefined();
  });
});
