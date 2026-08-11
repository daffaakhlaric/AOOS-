import { createHmac } from "node:crypto";

import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { ConversationService } from "../../src/application/services/ConversationService.js";
import { WebhookProcessorService } from "../../src/application/services/WebhookProcessorService.js";
import { ProcessIncomingWebhook } from "../../src/application/use-cases/ProcessIncomingWebhook.js";
import { WabaAccount } from "../../src/domain/entities/WabaAccount.js";
import { WhatsAppConnectorEvents } from "../../src/domain/events/WhatsAppConnectorEvents.js";
import { PhoneNumber } from "../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../src/domain/value-objects/WabaId.js";
import { WebhookParser } from "../../src/infrastructure/webhook/WebhookParser.js";
import { WebhookVerifier } from "../../src/infrastructure/webhook/WebhookVerifier.js";
import { WabaRegistry } from "../../src/registry/WabaRegistry.js";
import {
  BANDUNG_PHONE_NUMBER_ID,
  BINTARO_PHONE_NUMBER_ID,
  CINERE_PHONE_NUMBER_ID,
  WABA_ACCOUNTS_FIXTURE,
  textMessageWebhookPayload,
} from "../fixtures/waFixtures.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";
import { createFakeTracer } from "../helpers/tracer.js";

const APP_SECRET = "test-app-secret";

function sign(rawBody: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex")}`;
}

function makeUseCase() {
  const registry = new WabaRegistry();
  for (const config of WABA_ACCOUNTS_FIXTURE) {
    registry.register(
      unwrap(
        WabaAccount.create({
          id: unwrap(WabaId.create(config.wabaId)),
          phoneNumberId: unwrap(PhoneNumberId.create(config.phoneNumberId)),
          phoneNumber: unwrap(PhoneNumber.create(config.phoneNumber)),
          branch: config.branch,
          displayName: config.displayName,
          status: "ACTIVE",
          registeredAt: new Date(),
        }),
      ),
    );
  }
  const publisher = createFakePublisher();
  const events = new WhatsAppConnectorEvents(publisher);
  const useCase = new ProcessIncomingWebhook(
    new WebhookVerifier(),
    new WebhookParser(),
    registry,
    new WebhookProcessorService(new ConversationService()),
    events,
    createMockLogger() as never,
    createFakeTracer(),
  );
  return { useCase, publisher };
}

describe("Multi-WABA routing", () => {
  it.each([
    ["Bintaro", BINTARO_PHONE_NUMBER_ID, Branch.BINTARO],
    ["Cinere", CINERE_PHONE_NUMBER_ID, Branch.CINERE],
    ["Bandung", BANDUNG_PHONE_NUMBER_ID, Branch.BANDUNG],
  ] as const)(
    "message to %s WABA -> branch = %s",
    async (_label, phoneNumberId, expectedBranch) => {
      const { useCase, publisher } = makeUseCase();
      const payload = textMessageWebhookPayload({
        phoneNumberId,
        from: "628123456789",
        wamid: `wamid.${phoneNumberId}`,
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
      const received = publisher.published.find((e) => e.type === "aaos.whatsapp.message.received");
      expect(received).toBeDefined();
      expect((received?.payload as { branch: string }).branch).toBe(expectedBranch);
    },
  );

  it("routes the fourth WABA (Pondok Bambu config) to Branch.UMUM per the engineering report resolution #1", async () => {
    const { useCase, publisher } = makeUseCase();
    const pondokBambuConfig = WABA_ACCOUNTS_FIXTURE[3];
    expect(pondokBambuConfig?.branch).toBe(Branch.UMUM);
    const payload = textMessageWebhookPayload({
      phoneNumberId: pondokBambuConfig!.phoneNumberId,
      from: "628123456789",
      wamid: "wamid.pb",
      body: "Halo",
    });
    const rawBody = JSON.stringify(payload);
    await useCase.execute({
      rawBody,
      signature: sign(rawBody),
      webhookAppSecret: APP_SECRET,
      tenantId: "dss-motor",
      correlationId: "corr-2",
    });
    const received = publisher.published.find((e) => e.type === "aaos.whatsapp.message.received");
    expect((received?.payload as { branch: string }).branch).toBe(Branch.UMUM);
  });
});
