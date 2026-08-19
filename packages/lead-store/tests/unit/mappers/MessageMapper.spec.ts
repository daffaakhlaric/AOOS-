import { describe, expect, it } from "vitest";

import { MessageMapper } from "../../../src/infrastructure/mappers/MessageMapper.js";
import { makeMessageRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("MessageMapper.toDomain", () => {
  it("maps every field exactly, 1:1", () => {
    const row = makeMessageRow({
      direction: "OUTGOING",
      message_type: "TEMPLATE",
      body: "Halo Budi",
      wamid: "wamid.123",
      template_name: "greeting_v1",
      delivery_status: "DELIVERED",
      sent_at: "2026-01-15T09:00:00.000Z",
      delivered_at: "2026-01-15T09:00:05.000Z",
      read_at: "2026-01-15T09:01:00.000Z",
      created_at: "2026-01-15T09:00:00.000Z",
    });

    const message = unwrap(MessageMapper.toDomain(row));

    expect(message.id.toString()).toBe(row.id);
    expect(message.conversationId.toString()).toBe(row.conversation_id);
    expect(message.leadId.toString()).toBe(row.lead_id);
    expect(message.direction).toBe("OUTGOING");
    expect(message.messageType).toBe("TEMPLATE");
    expect(message.body).toBe("Halo Budi");
    expect(message.wamid).toBe("wamid.123");
    expect(message.templateName).toBe("greeting_v1");
    expect(message.deliveryStatus).toBe("DELIVERED");
    expect(message.sentAt?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(message.deliveredAt?.toISOString()).toBe("2026-01-15T09:00:05.000Z");
    expect(message.readAt?.toISOString()).toBe("2026-01-15T09:01:00.000Z");
    expect(message.createdAt.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("maps null optional columns to undefined", () => {
    const message = unwrap(
      MessageMapper.toDomain(
        makeMessageRow({
          body: null,
          wamid: null,
          template_name: null,
          delivery_status: null,
          sent_at: null,
          delivered_at: null,
          read_at: null,
        }),
      ),
    );
    expect(message.body).toBeUndefined();
    expect(message.wamid).toBeUndefined();
    expect(message.templateName).toBeUndefined();
    expect(message.deliveryStatus).toBeUndefined();
    expect(message.sentAt).toBeUndefined();
    expect(message.deliveredAt).toBeUndefined();
    expect(message.readAt).toBeUndefined();
  });

  it("fails on an invalid direction", () => {
    const error = unwrapErr(MessageMapper.toDomain(makeMessageRow({ direction: "SIDEWAYS" })));
    expect(error.message).toContain("direction");
  });

  it("fails on an invalid message_type", () => {
    const error = unwrapErr(MessageMapper.toDomain(makeMessageRow({ message_type: "VIDEO" })));
    expect(error.message).toContain("message_type");
  });

  it("fails on an invalid delivery_status", () => {
    const error = unwrapErr(MessageMapper.toDomain(makeMessageRow({ delivery_status: "BOUNCED" })));
    expect(error.message).toContain("delivery_status");
  });

  it("fails on an invalid id", () => {
    const error = unwrapErr(MessageMapper.toDomain(makeMessageRow({ id: "" })));
    expect(error.message).toContain("MessageId");
  });

  it("fails on an invalid conversation_id", () => {
    const error = unwrapErr(MessageMapper.toDomain(makeMessageRow({ conversation_id: "" })));
    expect(error.message).toContain("ConversationId");
  });

  it("fails on an invalid lead_id", () => {
    const error = unwrapErr(MessageMapper.toDomain(makeMessageRow({ lead_id: "" })));
    expect(error.message).toContain("LeadId");
  });

  it("fails on an invalid sender_type", () => {
    const error = unwrapErr(MessageMapper.toDomain(makeMessageRow({ sender_type: "ROBOT" })));
    expect(error.message).toContain("sender_type");
  });

  it("maps sender_type/sender_name (AAOS-CHAT-ROOM-JESSY coordinator note #2)", () => {
    const message = unwrap(
      MessageMapper.toDomain(
        makeMessageRow({
          direction: "OUTGOING",
          sender_type: "SALES_HUMAN",
          sender_name: "Ahmad Fauzi",
        }),
      ),
    );
    expect(message.senderType).toBe("SALES_HUMAN");
    expect(message.senderName).toBe("Ahmad Fauzi");
  });

  it("maps a null sender_type/sender_name to undefined", () => {
    const message = unwrap(
      MessageMapper.toDomain(makeMessageRow({ sender_type: null, sender_name: null })),
    );
    expect(message.senderType).toBeUndefined();
    expect(message.senderName).toBeUndefined();
  });
});

describe("MessageMapper.toRow", () => {
  it("round-trips every field exactly", () => {
    const row = makeMessageRow({ delivery_status: "READ", wamid: "wamid.9" });
    const message = unwrap(MessageMapper.toDomain(row));
    expect(MessageMapper.toRow(message)).toEqual(row);
  });

  it("maps undefined optional fields to null", () => {
    const row = makeMessageRow({
      body: null,
      wamid: null,
      template_name: null,
      delivery_status: null,
      sent_at: null,
      delivered_at: null,
      read_at: null,
    });
    const message = unwrap(MessageMapper.toDomain(row));
    const mapped = MessageMapper.toRow(message);
    expect(mapped.body).toBeNull();
    expect(mapped.wamid).toBeNull();
    expect(mapped.template_name).toBeNull();
    expect(mapped.delivery_status).toBeNull();
    expect(mapped.sent_at).toBeNull();
    expect(mapped.delivered_at).toBeNull();
    expect(mapped.read_at).toBeNull();
  });
});
