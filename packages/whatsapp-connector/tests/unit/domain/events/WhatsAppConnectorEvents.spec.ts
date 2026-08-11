import { EventCategory } from "@aos/event-bus";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { WhatsAppConnectorEvents } from "../../../../src/domain/events/WhatsAppConnectorEvents.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const TENANT_ID = "dss-motor";
const CORRELATION_ID = "corr-1";
const OCCURRED_AT = new Date("2026-01-01T00:00:00.000Z");

describe("WhatsAppConnectorEvents", () => {
  it("publishMessageReceived publishes type aaos.whatsapp.message.received", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishMessageReceived({
      messageId: "wamid.1",
      conversationId: "conv-1",
      from: "+628123456789",
      to: "100000000000001",
      branch: Branch.BINTARO,
      phoneNumberId: "100000000000001",
      type: "TEXT" as never,
      body: "Halo",
      isFirstMessage: true,
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.whatsapp.message.received");
  });

  it("publishMessageSent publishes type aaos.whatsapp.message.sent", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishMessageSent({
      messageId: "wamid.2",
      conversationId: "conv-1",
      to: "+628123456789",
      from: "100000000000001",
      branch: Branch.BINTARO,
      phoneNumberId: "100000000000001",
      type: "TEXT" as never,
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.whatsapp.message.sent");
  });

  it("publishMessageDelivered publishes type aaos.whatsapp.message.delivered", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishMessageDelivered({
      messageId: "wamid.3",
      recipientId: "628123456789",
      branch: Branch.CINERE,
      phoneNumberId: "100000000000002",
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.whatsapp.message.delivered");
  });

  it("publishMessageRead publishes type aaos.whatsapp.message.read", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishMessageRead({
      messageId: "wamid.4",
      recipientId: "628123456789",
      branch: Branch.BANDUNG,
      phoneNumberId: "100000000000004",
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.whatsapp.message.read");
  });

  it("publishMessageFailed publishes type aaos.whatsapp.message.failed and carries error details", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishMessageFailed({
      messageId: "wamid.5",
      recipientId: "628123456789",
      branch: Branch.UMUM,
      phoneNumberId: "100000000000003",
      errorCode: 131047,
      errorTitle: "Re-engagement message",
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.whatsapp.message.failed");
    expect((publisher.published[0]?.payload as { errorCode?: number }).errorCode).toBe(131047);
  });

  it("publishConversationStarted publishes type aaos.whatsapp.conversation.started", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishConversationStarted({
      conversationId: "conv-1",
      leadPhone: "+628123456789",
      branch: Branch.BINTARO,
      phoneNumberId: "100000000000001",
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.whatsapp.conversation.started");
  });

  it("publishWabaRegistered publishes type aaos.whatsapp.waba.registered", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishWabaRegistered({
      wabaId: "waba-1",
      phoneNumberId: "100000000000001",
      branch: Branch.BINTARO,
      displayName: "Mobix Bintaro",
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.whatsapp.waba.registered");
  });

  it("every publish uses EventCategory.DOMAIN and the envelope version 1.0.0", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishWabaRegistered({
      wabaId: "waba-1",
      phoneNumberId: "100000000000001",
      branch: Branch.BINTARO,
      displayName: "Mobix Bintaro",
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.category).toBe(EventCategory.DOMAIN);
    expect(publisher.published[0]?.version).toBe("1.0.0");
  });

  it("forwards tenantId and correlationId from the payload onto the envelope", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishConversationStarted({
      conversationId: "conv-2",
      leadPhone: "+628199999999",
      branch: Branch.BINTARO,
      phoneNumberId: "100000000000001",
      tenantId: "another-tenant",
      correlationId: "corr-xyz",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.tenantId).toBe("another-tenant");
    expect(publisher.published[0]?.correlationId).toBe("corr-xyz");
  });

  it("defaults source to @aos/whatsapp-connector when not provided", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    await events.publishWabaRegistered({
      wabaId: "waba-1",
      phoneNumberId: "100000000000001",
      branch: Branch.BINTARO,
      displayName: "Mobix Bintaro",
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.source).toBe("@aos/whatsapp-connector");
    expect(publisher.published[0]?.producer).toBe("@aos/whatsapp-connector");
  });

  it("respects an explicit custom source override", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher, "custom-source");
    await events.publishWabaRegistered({
      wabaId: "waba-1",
      phoneNumberId: "100000000000001",
      branch: Branch.BINTARO,
      displayName: "Mobix Bintaro",
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.source).toBe("custom-source");
    // producer stays fixed regardless of source override — it identifies the owning package.
    expect(publisher.published[0]?.producer).toBe("@aos/whatsapp-connector");
  });

  it("carries the full payload through to the envelope unmodified", async () => {
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    const payload = {
      messageId: "wamid.6",
      conversationId: "conv-1",
      from: "+628123456789",
      to: "100000000000001",
      branch: Branch.BINTARO,
      phoneNumberId: "100000000000001",
      type: "TEXT" as never,
      body: "Halo",
      isFirstMessage: false,
      tenantId: TENANT_ID,
      correlationId: CORRELATION_ID,
      occurredAt: OCCURRED_AT,
      version: "1.0" as const,
    };
    await events.publishMessageReceived(payload);
    expect(publisher.published[0]?.payload).toEqual(payload);
  });
});
