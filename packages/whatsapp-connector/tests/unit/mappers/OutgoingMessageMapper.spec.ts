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
import { OutgoingMessageMapper } from "../../../src/mappers/OutgoingMessageMapper.js";
import type { WaSendMessageResponse } from "../../../src/types/WhatsAppApiTypes.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function preliminaryMessage() {
  const to = unwrap(PhoneNumber.create("+628123456789"));
  const from = unwrap(PhoneNumberId.create("100000000000001"));
  return unwrap(
    OutgoingMessage.create({
      id: MessageId.generate(),
      to,
      from,
      branch: Branch.BINTARO,
      conversationId: ConversationId.fromParticipants(to, from),
      type: MessageType.TEXT,
      body: unwrap(MessageBody.create("Halo")),
      status: MessageStatus.SENT,
    }),
  );
}

function responseWithWamid(wamid: string): WaSendMessageResponse {
  return {
    messaging_product: "whatsapp",
    contacts: [{ input: "+628123456789", wa_id: "628123456789" }],
    messages: [{ id: wamid }],
  };
}

describe("OutgoingMessageMapper.confirmFromResponse", () => {
  it("returns a NEW OutgoingMessage with the confirmed wamid and sentAt", () => {
    const preliminary = preliminaryMessage();
    const sentAt = new Date("2026-01-01T00:00:00.000Z");
    const confirmed = unwrap(
      OutgoingMessageMapper.confirmFromResponse(
        preliminary,
        responseWithWamid("wamid.real"),
        sentAt,
      ),
    );
    expect(confirmed.id.toString()).toBe("wamid.real");
    expect(confirmed.status).toBe(MessageStatus.SENT);
    expect(confirmed.sentAt).toEqual(sentAt);
    expect(confirmed).not.toBe(preliminary);
  });

  it("rejects a response with an empty messages array", () => {
    const preliminary = preliminaryMessage();
    const empty: WaSendMessageResponse = {
      messaging_product: "whatsapp",
      contacts: [],
      messages: [],
    };
    const error = unwrapErr(
      OutgoingMessageMapper.confirmFromResponse(preliminary, empty, new Date()),
    );
    expect(error.message).toContain("no message id");
  });

  it("rejects a response whose message id is an empty string", () => {
    const preliminary = preliminaryMessage();
    const error = unwrapErr(
      OutgoingMessageMapper.confirmFromResponse(preliminary, responseWithWamid(""), new Date()),
    );
    expect(error).toBeDefined();
  });
});
