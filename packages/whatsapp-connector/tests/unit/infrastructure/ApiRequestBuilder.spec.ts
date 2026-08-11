import { describe, expect, it } from "vitest";

import { ApiRequestBuilder } from "../../../src/infrastructure/whatsapp-api/ApiRequestBuilder.js";

describe("ApiRequestBuilder", () => {
  it("builds the messages URL for a phoneNumberId", () => {
    expect(ApiRequestBuilder.messagesUrl("123")).toBe(
      "https://graph.facebook.com/v21.0/123/messages",
    );
  });

  it("builds a text message body per the spec's wire format", () => {
    const body = ApiRequestBuilder.textBody({
      phoneNumberId: "123",
      accessToken: "token",
      to: "+628123456789",
      body: "Hai kak!",
    });
    expect(body).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+628123456789",
      type: "text",
      text: { preview_url: false, body: "Hai kak!" },
    });
  });

  it("respects an explicit previewUrl: true", () => {
    const body = ApiRequestBuilder.textBody({
      phoneNumberId: "123",
      accessToken: "token",
      to: "+628123456789",
      body: "link https://example.com",
      previewUrl: true,
    });
    expect(body.text?.preview_url).toBe(true);
  });

  it("builds a template message body per the spec's wire format", () => {
    const body = ApiRequestBuilder.templateBody({
      phoneNumberId: "123",
      accessToken: "token",
      to: "+628123456789",
      templateName: "hello_world",
      languageCode: "id",
      bodyParameters: ["Budi"],
    });
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "+628123456789",
      type: "template",
      template: {
        name: "hello_world",
        language: { code: "id" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Budi" }] }],
      },
    });
  });

  it("builds an interactive button message body per the spec's wire format", () => {
    const body = ApiRequestBuilder.interactiveBody({
      phoneNumberId: "123",
      accessToken: "token",
      to: "+628123456789",
      bodyText: "Mau lanjut diskusi soal Xpander?",
      buttons: [
        { id: "yes", title: "Ya, lanjut" },
        { id: "later", title: "Nanti dulu" },
      ],
    });
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "+628123456789",
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Mau lanjut diskusi soal Xpander?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "yes", title: "Ya, lanjut" } },
            { type: "reply", reply: { id: "later", title: "Nanti dulu" } },
          ],
        },
      },
    });
  });
});
