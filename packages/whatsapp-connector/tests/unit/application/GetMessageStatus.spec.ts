import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { ConversationService } from "../../../src/application/services/ConversationService.js";
import { WebhookProcessorService } from "../../../src/application/services/WebhookProcessorService.js";
import { GetMessageStatus } from "../../../src/application/use-cases/GetMessageStatus.js";
import { WabaAccount } from "../../../src/domain/entities/WabaAccount.js";
import { MessageStatus } from "../../../src/domain/value-objects/MessageStatus.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../../src/domain/value-objects/WabaId.js";
import type { WaWebhookValue } from "../../../src/types/WhatsAppWebhookTypes.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("GetMessageStatus", () => {
  it("returns the last-known status recorded by WebhookProcessorService", () => {
    const webhookProcessor = new WebhookProcessorService(new ConversationService());
    const waba = unwrap(
      WabaAccount.create({
        id: unwrap(WabaId.create("waba-1")),
        phoneNumberId: unwrap(PhoneNumberId.create("100000000000001")),
        phoneNumber: unwrap(PhoneNumber.create("+628110000001")),
        branch: Branch.BINTARO,
        displayName: "Mobix Bintaro",
        status: "ACTIVE",
        registeredAt: new Date(),
      }),
    );
    const value: WaWebhookValue = {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "+628110000001", phone_number_id: "100000000000001" },
      statuses: [
        { id: "wamid.1", status: "read", timestamp: "1700000000", recipient_id: "628123456789" },
      ],
    };
    webhookProcessor.process(value, waba, new Date());

    const useCase = new GetMessageStatus(webhookProcessor);
    const status = unwrap(useCase.execute("wamid.1"));
    expect(status.status).toBe(MessageStatus.READ);
  });

  it("returns NotFoundError for an unknown message id", () => {
    const useCase = new GetMessageStatus(new WebhookProcessorService(new ConversationService()));
    const error = unwrapErr(useCase.execute("unknown"));
    expect(error).toBeDefined();
  });
});
