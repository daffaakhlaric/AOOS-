import { describe, expect, it } from "vitest";

import { PayloadParseError } from "../../../src/domain/errors/index.js";
import { WebhookParser } from "../../../src/infrastructure/webhook/WebhookParser.js";
import {
  emptyMessagesWebhookPayload,
  interactiveButtonReplyWebhookPayload,
  statusUpdateWebhookPayload,
  textMessageWebhookPayload,
} from "../../fixtures/waFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("WebhookParser", () => {
  it("parses a text message payload", () => {
    const payload = textMessageWebhookPayload({
      phoneNumberId: "100000000000001",
      from: "628123456789",
      wamid: "wamid.1",
      body: "Halo kak",
    });
    const parsed = unwrap(new WebhookParser().parse(JSON.stringify(payload)));
    expect(parsed.entry[0]?.changes[0]?.value.messages?.[0]?.text?.body).toBe("Halo kak");
  });

  it("parses an interactive button reply payload", () => {
    const payload = interactiveButtonReplyWebhookPayload({
      phoneNumberId: "100000000000001",
      from: "628123456789",
      wamid: "wamid.2",
      buttonId: "yes",
      buttonTitle: "Ya, lanjut",
    });
    const parsed = unwrap(new WebhookParser().parse(JSON.stringify(payload)));
    expect(parsed.entry[0]?.changes[0]?.value.messages?.[0]?.interactive?.button_reply?.id).toBe(
      "yes",
    );
  });

  it("parses a status update payload", () => {
    const payload = statusUpdateWebhookPayload({
      phoneNumberId: "100000000000001",
      recipientId: "628123456789",
      wamid: "wamid.3",
      status: "delivered",
    });
    const parsed = unwrap(new WebhookParser().parse(JSON.stringify(payload)));
    expect(parsed.entry[0]?.changes[0]?.value.statuses?.[0]?.status).toBe("delivered");
  });

  it("parses an empty messages array as valid", () => {
    const payload = emptyMessagesWebhookPayload("100000000000001");
    const parsed = unwrap(new WebhookParser().parse(JSON.stringify(payload)));
    expect(parsed.entry[0]?.changes[0]?.value.messages).toEqual([]);
  });

  it("parses a status-only payload (no messages key) as valid", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-entry-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "+6281", phone_number_id: "1" },
                statuses: [
                  {
                    id: "wamid.4",
                    status: "sent",
                    timestamp: "1700000000",
                    recipient_id: "6281",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const parsed = unwrap(new WebhookParser().parse(JSON.stringify(payload)));
    expect(parsed.entry[0]?.changes[0]?.value.messages).toBeUndefined();
  });

  it("rejects invalid JSON", () => {
    const error = unwrapErr(new WebhookParser().parse("{not json"));
    expect(error).toBeInstanceOf(PayloadParseError);
  });

  it("rejects a payload that fails schema validation", () => {
    const error = unwrapErr(new WebhookParser().parse(JSON.stringify({ object: "wrong" })));
    expect(error).toBeInstanceOf(PayloadParseError);
  });

  it("rejects a root-level type mismatch, reporting the issue path as (root)", () => {
    const error = unwrapErr(new WebhookParser().parse(JSON.stringify("just a string")));
    expect(error).toBeInstanceOf(PayloadParseError);
    expect(error.context?.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("(root)")]),
    );
  });
});
