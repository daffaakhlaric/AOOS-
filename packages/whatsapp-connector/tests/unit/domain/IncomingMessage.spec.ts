import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { IncomingMessage } from "../../../src/domain/entities/IncomingMessage.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { MessageBody } from "../../../src/domain/value-objects/MessageBody.js";
import { MessageId } from "../../../src/domain/value-objects/MessageId.js";
import { MessageType } from "../../../src/domain/value-objects/MessageType.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  const from = unwrap(PhoneNumber.create("+628123456789"));
  const to = unwrap(PhoneNumberId.create("100000000000001"));
  return {
    id: unwrap(MessageId.create("wamid.1")),
    from,
    to,
    branch: Branch.BINTARO,
    conversationId: ConversationId.fromParticipants(from, to),
    type: MessageType.TEXT,
    body: unwrap(MessageBody.create("Halo")),
    timestamp: new Date("2026-01-01T00:00:00.000Z"),
    isFirstMessage: true,
  };
}

describe("IncomingMessage", () => {
  it("creates a TEXT message with a body", () => {
    const message = unwrap(IncomingMessage.create(baseProps()));
    expect(message.type).toBe(MessageType.TEXT);
    expect(message.body?.toString()).toBe("Halo");
    expect(message.isFirstMessage).toBe(true);
    expect(message.branch).toBe(Branch.BINTARO);
  });

  it("creates a non-TEXT message without a body", () => {
    const props = { ...baseProps(), type: MessageType.IMAGE, body: undefined };
    const message = unwrap(IncomingMessage.create(props));
    expect(message.body).toBeUndefined();
  });

  it("rejects an invalid type", () => {
    const error = unwrapErr(
      IncomingMessage.create({ ...baseProps(), type: "BOGUS" as unknown as MessageType }),
    );
    expect(error.message).toContain("type");
  });

  it("rejects a TEXT message with no body", () => {
    const error = unwrapErr(IncomingMessage.create({ ...baseProps(), body: undefined }));
    expect(error.message).toContain("body");
  });
});
