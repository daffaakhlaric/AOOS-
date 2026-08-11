import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { WhatsAppConnectorFactory } from "../../../src/factories/WhatsAppConnectorFactory.js";
import { makeConfig } from "../../fixtures/waFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

describe("WhatsAppConnectorFactory.create", () => {
  it("wires all 7 use cases and registers every configured WABA account", () => {
    const publisher = createFakePublisher();
    const connector = WhatsAppConnectorFactory.create({
      config: makeConfig(),
      publisher,
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(connector.registry.listAll()).toHaveLength(4);
    expect(connector.sendTextMessage).toBeDefined();
    expect(connector.sendTemplateMessage).toBeDefined();
    expect(connector.sendInteractiveMessage).toBeDefined();
    expect(connector.processIncomingWebhook).toBeDefined();
    expect(connector.verifyWebhook).toBeDefined();
    expect(connector.getMessageStatus).toBeDefined();
    expect(connector.getConversation).toBeDefined();

    // One WabaRegistered event per configured account.
    const registeredEvents = publisher.published.filter(
      (event) => event.type === "aaos.whatsapp.waba.registered",
    );
    expect(registeredEvents).toHaveLength(4);
  });

  it("resolves the branch for a registered phoneNumberId via the wired registry", () => {
    const connector = WhatsAppConnectorFactory.create({
      config: makeConfig(),
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });
    const found = unwrap(
      connector.registry.getByPhoneNumberId(unwrap(PhoneNumberId.create("100000000000001"))),
    );
    expect(found.branch).toBe(Branch.BINTARO);
  });

  it("uses default logger/tracer/now/fetchImpl when not provided", () => {
    const connector = WhatsAppConnectorFactory.create({
      config: makeConfig(),
      publisher: createFakePublisher(),
    });
    expect(connector.registry.listAll()).toHaveLength(4);
  });
});
