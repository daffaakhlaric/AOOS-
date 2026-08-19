import { describe, expect, it } from "vitest";

import { Message } from "../../../src/domain/entities/Message.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { MessageId } from "../../../src/domain/value-objects/MessageId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-01-15T09:00:00.000Z");

function baseProps() {
  return {
    id: MessageId.generate(),
    conversationId: ConversationId.generate(),
    leadId: LeadId.generate(),
    direction: "INCOMING" as const,
    messageType: "TEXT" as const,
    createdAt: NOW,
  };
}

describe("Message entity", () => {
  it("creates a valid INCOMING message", () => {
    const message = unwrap(Message.create({ ...baseProps(), body: "Halo" }));
    expect(message.direction).toBe("INCOMING");
    expect(message.body).toBe("Halo");
  });

  it("creates a valid OUTGOING message", () => {
    const message = unwrap(Message.create({ ...baseProps(), direction: "OUTGOING" }));
    expect(message.direction).toBe("OUTGOING");
  });

  it("rejects an invalid direction", () => {
    const error = unwrapErr(
      Message.create({ ...baseProps(), direction: "SIDEWAYS" as unknown as "INCOMING" }),
    );
    expect(error.message).toContain("direction");
  });

  it("exposes every getter matching the constructed props", () => {
    const props = baseProps();
    const message = unwrap(
      Message.create({
        ...props,
        wamid: "wamid.1",
        templateName: "greeting_v1",
        deliveryStatus: "SENT",
        sentAt: NOW,
        deliveredAt: NOW,
        readAt: NOW,
      }),
    );
    expect(message.id).toBe(props.id);
    expect(message.conversationId).toBe(props.conversationId);
    expect(message.leadId).toBe(props.leadId);
    expect(message.messageType).toBe("TEXT");
    expect(message.wamid).toBe("wamid.1");
    expect(message.templateName).toBe("greeting_v1");
    expect(message.deliveryStatus).toBe("SENT");
    expect(message.sentAt).toBe(NOW);
    expect(message.deliveredAt).toBe(NOW);
    expect(message.readAt).toBe(NOW);
    expect(message.createdAt).toBe(NOW);
  });

  it("leaves body/wamid/templateName undefined when omitted", () => {
    const message = unwrap(Message.create(baseProps()));
    expect(message.body).toBeUndefined();
    expect(message.wamid).toBeUndefined();
    expect(message.templateName).toBeUndefined();
  });

  it("exposes senderType/senderName when set (AAOS-CHAT-ROOM-JESSY coordinator note #2)", () => {
    const message = unwrap(
      Message.create({
        ...baseProps(),
        direction: "OUTGOING",
        senderType: "MANAGER_INTERVENTION",
        senderName: "Budi (Manager)",
      }),
    );
    expect(message.senderType).toBe("MANAGER_INTERVENTION");
    expect(message.senderName).toBe("Budi (Manager)");
  });

  it("leaves senderType/senderName undefined when omitted", () => {
    const message = unwrap(Message.create(baseProps()));
    expect(message.senderType).toBeUndefined();
    expect(message.senderName).toBeUndefined();
  });
});
