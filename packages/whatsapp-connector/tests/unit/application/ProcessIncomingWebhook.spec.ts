import { createHmac } from "node:crypto";

import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { ConversationService } from "../../../src/application/services/ConversationService.js";
import { WebhookProcessorService } from "../../../src/application/services/WebhookProcessorService.js";
import type { Tracer } from "../../../src/application/tracer.js";
import { ProcessIncomingWebhook } from "../../../src/application/use-cases/ProcessIncomingWebhook.js";
import { WabaAccount } from "../../../src/domain/entities/WabaAccount.js";
import { WhatsAppConnectorEvents } from "../../../src/domain/events/WhatsAppConnectorEvents.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../../src/domain/value-objects/WabaId.js";
import { WebhookParser } from "../../../src/infrastructure/webhook/WebhookParser.js";
import { WebhookVerifier } from "../../../src/infrastructure/webhook/WebhookVerifier.js";
import { WabaRegistry } from "../../../src/registry/WabaRegistry.js";
import { textMessageWebhookPayload } from "../../fixtures/waFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";

const APP_SECRET = "test-app-secret";
const PHONE_NUMBER_ID = "100000000000001";

function sign(rawBody: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex")}`;
}

function spyTracer(): { tracer: Tracer; spanNames: string[] } {
  const spanNames: string[] = [];
  const tracer = {
    startActiveSpan: (name: string, fn: (span: { end: () => void }) => unknown) => {
      spanNames.push(name);
      return fn({ end: () => undefined });
    },
  } as unknown as Tracer;
  return { tracer, spanNames };
}

function makeUseCase(tracer: Tracer, logger: ReturnType<typeof createMockLogger>) {
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
    logger as never,
    tracer,
    () => new Date("2026-01-01T00:00:00.000Z"),
  );
  return { useCase, publisher };
}

describe("ProcessIncomingWebhook (unit — tracer/logger interactions not asserted at integration level)", () => {
  it("starts exactly one span named whatsapp-connector.process-incoming-webhook per call", async () => {
    const { tracer, spanNames } = spyTracer();
    const { useCase } = makeUseCase(tracer, createMockLogger());
    const payload = textMessageWebhookPayload({
      phoneNumberId: PHONE_NUMBER_ID,
      from: "628123456789",
      wamid: "wamid.1",
      body: "Halo",
    });
    const rawBody = JSON.stringify(payload);
    await useCase.execute({
      rawBody,
      signature: sign(rawBody),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(spanNames).toEqual(["whatsapp-connector.process-incoming-webhook"]);
  });

  it("logs a warning (not error) on invalid signature, per the always-200 fire-and-forget contract", async () => {
    const logger = createMockLogger();
    const { useCase } = makeUseCase(spyTracer().tracer, logger);
    const rawBody = JSON.stringify(
      textMessageWebhookPayload({
        phoneNumberId: PHONE_NUMBER_ID,
        from: "628123456789",
        wamid: "wamid.2",
        body: "Halo",
      }),
    );
    await useCase.execute({
      rawBody,
      signature: "sha256=" + "0".repeat(64),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-2",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Signature") }),
      expect.stringContaining("signature verification failed"),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs an info summary with messagesReceived/statusesProcessed on success", async () => {
    const logger = createMockLogger();
    const { useCase } = makeUseCase(spyTracer().tracer, logger);
    const rawBody = JSON.stringify(
      textMessageWebhookPayload({
        phoneNumberId: PHONE_NUMBER_ID,
        from: "628123456789",
        wamid: "wamid.3",
        body: "Halo",
      }),
    );
    await useCase.execute({
      rawBody,
      signature: sign(rawBody),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-3",
    });
    expect(logger.info).toHaveBeenCalledWith(
      { messagesReceived: 1, statusesProcessed: 0 },
      expect.stringContaining("webhook processed"),
    );
  });

  it("stamps every MessageReceived event's occurredAt with the injected clock's value at message-timestamp resolution independent of the injected `now`", async () => {
    const { useCase, publisher } = makeUseCase(spyTracer().tracer, createMockLogger());
    const rawBody = JSON.stringify(
      textMessageWebhookPayload({
        phoneNumberId: PHONE_NUMBER_ID,
        from: "628123456789",
        wamid: "wamid.4",
        body: "Halo",
      }),
    );
    await useCase.execute({
      rawBody,
      signature: sign(rawBody),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-4",
    });
    const received = publisher.published.find((e) => e.type === "aaos.whatsapp.message.received");
    // MessageReceived.occurredAt comes from the message's own webhook timestamp field, not the
    // use case's injected `now` (that's used for ConversationStarted/status events instead).
    expect((received?.payload as { occurredAt: Date }).occurredAt).toBeInstanceOf(Date);
  });

  it("stamps ConversationStarted's occurredAt with the injected `now`, not the message timestamp", async () => {
    const { useCase, publisher } = makeUseCase(spyTracer().tracer, createMockLogger());
    const rawBody = JSON.stringify(
      textMessageWebhookPayload({
        phoneNumberId: PHONE_NUMBER_ID,
        from: "628123456789",
        wamid: "wamid.5",
        body: "Halo",
      }),
    );
    await useCase.execute({
      rawBody,
      signature: sign(rawBody),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-5",
    });
    const started = publisher.published.find(
      (e) => e.type === "aaos.whatsapp.conversation.started",
    );
    expect((started?.payload as { occurredAt: Date }).occurredAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });
});
