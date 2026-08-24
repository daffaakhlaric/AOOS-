import {
  EventCategory,
  EventPriority,
  type BaseEventShape,
  type IEventBroker,
} from "@aos/event-bus";
import { LeadBuilder, LeadStatus, type ILeadRepository, type Lead } from "@aos/lead-store";
import { Branch } from "@aos/meta-ads-connector";
import { MessageType, type MessageReceived, type WhatsAppConnector } from "@aos/whatsapp-connector";
import { describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";

import type {
  BroadcastLogRepository,
  BroadcastLogRow,
} from "./infrastructure/broadcast-log.repository.js";
import { RecyclingReplyListener } from "./recycling-reply-listener.js";

const NOW = new Date("2026-01-20T10:00:00.000Z");

function unwrap<T>(result: { ok: boolean; value?: T }): T {
  if (!result.ok) {
    throw new Error("test lead build failed");
  }
  return result.value as T;
}

function buildFakeEventBroker(): IEventBroker {
  return {
    subscribe: vi.fn(() => "sub-1"),
    unsubscribe: vi.fn(),
    subscriberCount: 0,
    publish: vi.fn(),
    publishAsync: vi.fn(),
    publishBatch: vi.fn(),
  } as unknown as IEventBroker;
}

function buildFakeLeadRepository(lead: Lead | undefined): ILeadRepository {
  return {
    findByPhoneAndBranch: vi.fn(async () => ({ ok: true, value: lead })),
  } as unknown as ILeadRepository;
}

function buildFakeWhatsAppConnector(): WhatsAppConnector {
  return {
    sendTextMessage: {
      execute: vi.fn(async () => ({ ok: true, value: {} })),
    },
  } as unknown as WhatsAppConnector;
}

function buildFakeLogRepository(logs: readonly BroadcastLogRow[]): BroadcastLogRepository {
  return {
    listByLead: vi.fn(async () => logs),
    markReplied: vi.fn(async () => undefined),
  } as unknown as BroadcastLogRepository;
}

function buildLog(overrides: Partial<BroadcastLogRow> = {}): BroadcastLogRow {
  return {
    id: "log-1",
    tenant_id: "dss-motor",
    lead_id: "lead-1",
    template_id: "template-1",
    message_sent: "Halo!",
    status: "SENT",
    sent_at: "2026-01-15T08:00:00.000Z",
    delivered_at: null,
    read_at: null,
    replied: false,
    replied_at: null,
    converted_to_hot: false,
    converted_at: null,
    ...overrides,
  };
}

function buildEvent(payload: MessageReceived): BaseEventShape {
  return {
    eventId: "evt-1",
    type: "aaos.whatsapp.message.received",
    category: EventCategory.DOMAIN,
    correlationId: "corr-1",
    tenantId: payload.tenantId,
    source: "@aos/whatsapp-connector",
    producer: "@aos/whatsapp-connector",
    timestamp: NOW.toISOString(),
    priority: EventPriority.NORMAL,
    version: "1.0.0",
    schemaVersion: "1.0.0",
    payload,
  };
}

function buildPayload(overrides: Partial<MessageReceived> = {}): MessageReceived {
  return {
    messageId: "msg-1",
    conversationId: "conv-1",
    from: "+6281200000097",
    to: "waba-umum-1",
    branch: Branch.UMUM,
    phoneNumberId: "waba-umum-1",
    type: MessageType.TEXT,
    body: "Ya, tertarik!",
    isFirstMessage: false,
    tenantId: "dss-motor",
    correlationId: "corr-1",
    occurredAt: NOW,
    version: "1.0",
    ...overrides,
  };
}

describe("RecyclingReplyListener.onModuleInit", () => {
  it("subscribes to aaos.whatsapp.message.received", () => {
    const eventBroker = buildFakeEventBroker();
    const listener = new RecyclingReplyListener(
      eventBroker,
      buildTestConfig(),
      buildFakeLeadRepository(undefined),
      buildFakeWhatsAppConnector(),
      buildFakeLogRepository([]),
      () => NOW,
    );
    listener.onModuleInit();
    expect(eventBroker.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ criteria: { topic: "aaos.whatsapp.message.received" } }),
    );
  });
});

describe("RecyclingReplyListener.handleMessageReceived", () => {
  it("marks the most recent un-replied broadcast log replied and sends exactly one greeting", async () => {
    const lead = unwrap(
      new LeadBuilder()
        .withLeadName("Pak Hendra")
        .withBroadcastCount(1)
        .withStatus(LeadStatus.WARM)
        .build(),
    );
    const leadRepository = buildFakeLeadRepository(lead);
    const whatsAppConnector = buildFakeWhatsAppConnector();
    const logRepository = buildFakeLogRepository([buildLog({ replied: false })]);
    const listener = new RecyclingReplyListener(
      buildFakeEventBroker(),
      buildTestConfig(),
      leadRepository,
      whatsAppConnector,
      logRepository,
      () => NOW,
    );

    await listener.handleMessageReceived(buildEvent(buildPayload()));

    expect(logRepository.markReplied).toHaveBeenCalledWith("log-1", NOW.toISOString());
    expect(leadRepository.findByPhoneAndBranch).toHaveBeenCalledWith(
      "+6281200000097",
      expect.anything(),
      "dss-motor",
    );
    expect(whatsAppConnector.sendTextMessage.execute).toHaveBeenCalledTimes(1);
    const call = (whatsAppConnector.sendTextMessage.execute as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as { body: string };
    expect(call.body).toContain("Pak Hendra");
  });

  it("does nothing for a lead with broadcastCount=0 (never in the recycling pool)", async () => {
    const lead = unwrap(new LeadBuilder().withBroadcastCount(0).build());
    const leadRepository = buildFakeLeadRepository(lead);
    const whatsAppConnector = buildFakeWhatsAppConnector();
    const logRepository = buildFakeLogRepository([buildLog({ replied: false })]);
    const listener = new RecyclingReplyListener(
      buildFakeEventBroker(),
      buildTestConfig(),
      leadRepository,
      whatsAppConnector,
      logRepository,
      () => NOW,
    );

    await listener.handleMessageReceived(buildEvent(buildPayload()));

    expect(logRepository.markReplied).not.toHaveBeenCalled();
    expect(whatsAppConnector.sendTextMessage.execute).not.toHaveBeenCalled();
  });

  it("does nothing for a recyclingArchived lead", async () => {
    const lead = unwrap(
      new LeadBuilder().withBroadcastCount(3).withRecyclingArchived(true).build(),
    );
    const leadRepository = buildFakeLeadRepository(lead);
    const whatsAppConnector = buildFakeWhatsAppConnector();
    const logRepository = buildFakeLogRepository([buildLog({ replied: false })]);
    const listener = new RecyclingReplyListener(
      buildFakeEventBroker(),
      buildTestConfig(),
      leadRepository,
      whatsAppConnector,
      logRepository,
      () => NOW,
    );

    await listener.handleMessageReceived(buildEvent(buildPayload()));
    expect(whatsAppConnector.sendTextMessage.execute).not.toHaveBeenCalled();
  });

  it("does nothing when no lead matches the phone/branch", async () => {
    const leadRepository = buildFakeLeadRepository(undefined);
    const whatsAppConnector = buildFakeWhatsAppConnector();
    const logRepository = buildFakeLogRepository([]);
    const listener = new RecyclingReplyListener(
      buildFakeEventBroker(),
      buildTestConfig(),
      leadRepository,
      whatsAppConnector,
      logRepository,
      () => NOW,
    );

    await listener.handleMessageReceived(buildEvent(buildPayload()));
    expect(whatsAppConnector.sendTextMessage.execute).not.toHaveBeenCalled();
  });

  it("does nothing when every existing broadcast log is already marked replied (avoids repeat greetings)", async () => {
    const lead = unwrap(new LeadBuilder().withBroadcastCount(1).build());
    const leadRepository = buildFakeLeadRepository(lead);
    const whatsAppConnector = buildFakeWhatsAppConnector();
    const logRepository = buildFakeLogRepository([buildLog({ replied: true })]);
    const listener = new RecyclingReplyListener(
      buildFakeEventBroker(),
      buildTestConfig(),
      leadRepository,
      whatsAppConnector,
      logRepository,
      () => NOW,
    );

    await listener.handleMessageReceived(buildEvent(buildPayload()));
    expect(whatsAppConnector.sendTextMessage.execute).not.toHaveBeenCalled();
  });

  it("ignores an event for a different tenant", async () => {
    const lead = unwrap(new LeadBuilder().withBroadcastCount(1).build());
    const leadRepository = buildFakeLeadRepository(lead);
    const whatsAppConnector = buildFakeWhatsAppConnector();
    const logRepository = buildFakeLogRepository([buildLog({ replied: false })]);
    const listener = new RecyclingReplyListener(
      buildFakeEventBroker(),
      buildTestConfig(),
      leadRepository,
      whatsAppConnector,
      logRepository,
      () => NOW,
    );

    await listener.handleMessageReceived(buildEvent(buildPayload({ tenantId: "other-tenant" })));
    expect(leadRepository.findByPhoneAndBranch).not.toHaveBeenCalled();
  });

  it("ignores an event with a different type (defense in depth beyond the subscribe filter)", async () => {
    const leadRepository = buildFakeLeadRepository(undefined);
    const listener = new RecyclingReplyListener(
      buildFakeEventBroker(),
      buildTestConfig(),
      leadRepository,
      buildFakeWhatsAppConnector(),
      buildFakeLogRepository([]),
      () => NOW,
    );
    const event = { ...buildEvent(buildPayload()), type: "aaos.whatsapp.message.sent" };
    await listener.handleMessageReceived(event);
    expect(leadRepository.findByPhoneAndBranch).not.toHaveBeenCalled();
  });
});
