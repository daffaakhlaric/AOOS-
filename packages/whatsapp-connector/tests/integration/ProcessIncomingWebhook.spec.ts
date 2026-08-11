import { createHmac } from "node:crypto";

import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { ConversationService } from "../../src/application/services/ConversationService.js";
import { WebhookProcessorService } from "../../src/application/services/WebhookProcessorService.js";
import { ProcessIncomingWebhook } from "../../src/application/use-cases/ProcessIncomingWebhook.js";
import { WabaAccount } from "../../src/domain/entities/WabaAccount.js";
import { SignatureVerificationError } from "../../src/domain/errors/index.js";
import { WhatsAppConnectorEvents } from "../../src/domain/events/WhatsAppConnectorEvents.js";
import { PhoneNumber } from "../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../src/domain/value-objects/WabaId.js";
import { WebhookParser } from "../../src/infrastructure/webhook/WebhookParser.js";
import { WebhookVerifier } from "../../src/infrastructure/webhook/WebhookVerifier.js";
import { WabaRegistry } from "../../src/registry/WabaRegistry.js";
import { statusUpdateWebhookPayload, textMessageWebhookPayload } from "../fixtures/waFixtures.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";
import { createFakeTracer } from "../helpers/tracer.js";

const APP_SECRET = "test-app-secret";
const PHONE_NUMBER_ID = "100000000000001";

function sign(rawBody: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex")}`;
}

function makeUseCase() {
  const registry = new WabaRegistry();
  registry.register(
    unwrap(
      WabaAccount.create({
        id: unwrap(WabaId.create("waba-1")),
        phoneNumberId: unwrap(PhoneNumberId.create(PHONE_NUMBER_ID)),
        phoneNumber: unwrap(PhoneNumber.create("+628110000001")),
        branch: Branch.BINTARO,
        displayName: "Mobix Bintaro",
        status: "ACTIVE",
        registeredAt: new Date(),
      }),
    ),
  );
  const publisher = createFakePublisher();
  const events = new WhatsAppConnectorEvents(publisher);
  const webhookProcessor = new WebhookProcessorService(new ConversationService());
  const useCase = new ProcessIncomingWebhook(
    new WebhookVerifier(),
    new WebhookParser(),
    registry,
    webhookProcessor,
    events,
    createMockLogger() as never,
    createFakeTracer(),
    () => new Date("2026-01-01T00:00:00.000Z"),
  );
  return { useCase, publisher, registry };
}

describe("ProcessIncomingWebhook", () => {
  it("text message from lead -> MessageReceived event", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = textMessageWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      from: "628123456789",
      wamid: "wamid.1",
      body: "Halo kak",
    });
    const rawBody = JSON.stringify(payload);
    const result = unwrap(
      await useCase.execute({
        rawBody,
        signature: sign(rawBody),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(result.messagesReceived).toBe(1);
    const received = publisher.published.filter((e) => e.type === "aaos.whatsapp.message.received");
    expect(received).toHaveLength(1);
  });

  it("first message -> ConversationStarted event", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = textMessageWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      from: "628123456789",
      wamid: "wamid.2",
      body: "Halo kak",
    });
    const rawBody = JSON.stringify(payload);
    await useCase.execute({
      rawBody,
      signature: sign(rawBody),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-2",
    });
    const started = publisher.published.filter(
      (e) => e.type === "aaos.whatsapp.conversation.started",
    );
    expect(started).toHaveLength(1);
  });

  it("second message in the same conversation does NOT re-emit ConversationStarted", async () => {
    const { useCase, publisher } = makeUseCase();
    const first = textMessageWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      from: "628123456789",
      wamid: "wamid.3",
      body: "Halo",
    });
    const second = textMessageWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      from: "628123456789",
      wamid: "wamid.4",
      body: "Masih ada?",
    });
    for (const payload of [first, second]) {
      const rawBody = JSON.stringify(payload);
      await useCase.execute({
        rawBody,
        signature: sign(rawBody),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-x",
      });
    }
    const started = publisher.published.filter(
      (e) => e.type === "aaos.whatsapp.conversation.started",
    );
    expect(started).toHaveLength(1);
  });

  it("status delivered -> MessageDelivered event", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = statusUpdateWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      recipientId: "628123456789",
      wamid: "wamid.5",
      status: "delivered",
    });
    const rawBody = JSON.stringify(payload);
    const result = unwrap(
      await useCase.execute({
        rawBody,
        signature: sign(rawBody),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-3",
      }),
    );
    expect(result.statusesProcessed).toBe(1);
    const delivered = publisher.published.filter(
      (e) => e.type === "aaos.whatsapp.message.delivered",
    );
    expect(delivered).toHaveLength(1);
  });

  it("status read -> MessageRead event", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = statusUpdateWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      recipientId: "628123456789",
      wamid: "wamid.6",
      status: "read",
    });
    const rawBody = JSON.stringify(payload);
    await useCase.execute({
      rawBody,
      signature: sign(rawBody),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-4",
    });
    expect(publisher.published.some((e) => e.type === "aaos.whatsapp.message.read")).toBe(true);
  });

  it("status failed -> MessageFailed event with error details", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = statusUpdateWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      recipientId: "628123456789",
      wamid: "wamid.7",
      status: "failed",
      errorCode: 131047,
      errorTitle: "Re-engagement message",
    });
    const rawBody = JSON.stringify(payload);
    await useCase.execute({
      rawBody,
      signature: sign(rawBody),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-5",
    });
    const failed = publisher.published.find((e) => e.type === "aaos.whatsapp.message.failed");
    expect(failed).toBeDefined();
    expect((failed?.payload as { errorCode?: number }).errorCode).toBe(131047);
  });

  it("status sent -> no dedicated webhook status event published", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = statusUpdateWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      recipientId: "628123456789",
      wamid: "wamid.8",
      status: "sent",
    });
    const rawBody = JSON.stringify(payload);
    const result = unwrap(
      await useCase.execute({
        rawBody,
        signature: sign(rawBody),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-6",
      }),
    );
    expect(result.statusesProcessed).toBe(1);
    expect(publisher.published).toHaveLength(0);
  });

  it("invalid signature -> SignatureVerificationError", async () => {
    const { useCase } = makeUseCase();
    const payload = textMessageWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      from: "628123456789",
      wamid: "wamid.9",
      body: "Halo",
    });
    const rawBody = JSON.stringify(payload);
    const error = unwrapErr(
      await useCase.execute({
        rawBody,
        signature: "sha256=deadbeef".padEnd(71, "0"),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-7",
      }),
    );
    expect(error).toBeInstanceOf(SignatureVerificationError);
  });

  it("unknown phone_number_id -> WabaNotFoundError logged, 200-equivalent Result.ok returned (batch still succeeds)", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = textMessageWebhookPayload({
      phoneNumberId: "does-not-exist",
      from: "628123456789",
      wamid: "wamid.10",
      body: "Halo",
    });
    const rawBody = JSON.stringify(payload);
    const result = unwrap(
      await useCase.execute({
        rawBody,
        signature: sign(rawBody),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-8",
      }),
    );
    expect(result.messagesReceived).toBe(0);
    expect(publisher.published).toHaveLength(0);
  });

  it("an empty phone_number_id is logged and skipped without failing the batch", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = textMessageWebhookPayload({
      phoneNumberId: "",
      from: "628123456789",
      wamid: "wamid.11",
      body: "Halo",
    });
    const rawBody = JSON.stringify(payload);
    const result = unwrap(
      await useCase.execute({
        rawBody,
        signature: sign(rawBody),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-10",
      }),
    );
    expect(result.messagesReceived).toBe(0);
    expect(publisher.published).toHaveLength(0);
  });

  it("a value that fails WebhookProcessorService mapping (e.g. body too long) is logged and skipped without failing the batch", async () => {
    const { useCase, publisher } = makeUseCase();
    const payload = textMessageWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      from: "628123456789",
      wamid: "wamid.12",
      body: "a".repeat(4097),
    });
    const rawBody = JSON.stringify(payload);
    const result = unwrap(
      await useCase.execute({
        rawBody,
        signature: sign(rawBody),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-11",
      }),
    );
    expect(result.messagesReceived).toBe(0);
    expect(publisher.published).toHaveLength(0);
  });

  it("rejects an unparsable payload", async () => {
    const { useCase } = makeUseCase();
    const rawBody = "{not json";
    const error = unwrapErr(
      await useCase.execute({
        rawBody,
        signature: sign(rawBody),
        webhookAppSecret: APP_SECRET,
        tenantId: "dss-motor",
        correlationId: "corr-9",
      }),
    );
    expect(error).toBeDefined();
  });
});
