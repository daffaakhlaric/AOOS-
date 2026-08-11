import "reflect-metadata";

import { err, ok } from "@aos/common";
import { TokenVerificationError } from "@aos/whatsapp-connector";
import { describe, expect, it, vi } from "vitest";

import { buildFakeReply } from "../../test-support/nest-mocks.js";

import { WhatsAppSignatureGuard } from "./guards/whatsapp-signature.guard.js";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller.js";
import type { WhatsAppWebhookService } from "./whatsapp-webhook.service.js";

function buildFakeService(): WhatsAppWebhookService {
  return {
    verifyHandshake: vi.fn(),
    processIncomingWebhookAsync: vi.fn(async () => undefined),
  } as unknown as WhatsAppWebhookService;
}

describe("WhatsAppWebhookController", () => {
  describe("GET /webhooks/whatsapp (handshake)", () => {
    it("responds 200 with the plain-text challenge on success", () => {
      const service = buildFakeService();
      (service.verifyHandshake as ReturnType<typeof vi.fn>).mockReturnValue(ok("challenge-abc"));
      const controller = new WhatsAppWebhookController(service);
      const reply = buildFakeReply();

      controller.handshake("subscribe", "verify-token", "challenge-abc", reply as never);

      expect(reply.statusCode).toBe(200);
      expect(reply.headers["content-type"]).toBe("text/plain");
      expect(reply.body[0]).toBe("challenge-abc");
    });

    it("responds 403 with the verifier's error message on failure", () => {
      const service = buildFakeService();
      (service.verifyHandshake as ReturnType<typeof vi.fn>).mockReturnValue(
        err(new TokenVerificationError("bad token")),
      );
      const controller = new WhatsAppWebhookController(service);
      const reply = buildFakeReply();

      controller.handshake("subscribe", "wrong-token", "challenge-abc", reply as never);

      expect(reply.statusCode).toBe(403);
      expect(reply.body[0]).toBe("bad token");
    });
  });

  describe("POST /webhooks/whatsapp (handleWebhook)", () => {
    it("kicks off processIncomingWebhookAsync fire-and-forget and returns { received: true } immediately", async () => {
      const service = buildFakeService();
      const controller = new WhatsAppWebhookController(service);
      const rawBody = Buffer.from('{"object":"whatsapp_business_account","entry":[]}', "utf8");
      const request = {
        headers: { "x-hub-signature-256": "sha256=abc" },
        rawBody,
      } as never;

      const result = controller.handleWebhook(request, "corr-1");

      expect(result).toEqual({ received: true });
      expect(service.processIncomingWebhookAsync).toHaveBeenCalledWith(
        '{"object":"whatsapp_business_account","entry":[]}',
        "sha256=abc",
        "corr-1",
      );
    });

    it("passes an empty string body when rawBody is missing", () => {
      const service = buildFakeService();
      const controller = new WhatsAppWebhookController(service);
      const request = { headers: {} } as never;

      controller.handleWebhook(request, "corr-2");

      expect(service.processIncomingWebhookAsync).toHaveBeenCalledWith("", undefined, "corr-2");
    });

    it("still returns { received: true } even when processIncomingWebhookAsync rejects — the always-200 contract", async () => {
      const service = {
        verifyHandshake: vi.fn(),
        processIncomingWebhookAsync: vi.fn(async () => {
          throw new Error("boom");
        }),
      } as unknown as WhatsAppWebhookService;
      const controller = new WhatsAppWebhookController(service);
      const request = { headers: {} } as never;

      const result = controller.handleWebhook(request, "corr-3");

      expect(result).toEqual({ received: true });
      // Let the fire-and-forget rejection's .catch() run before the test exits, so it doesn't
      // surface as an unhandled rejection in a later test.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it("guards the handleWebhook handler with WhatsAppSignatureGuard", () => {
      const service = buildFakeService();
      const controller = new WhatsAppWebhookController(service);
      const guards = Reflect.getMetadata("__guards__", controller.handleWebhook) as unknown[];
      expect(guards).toContain(WhatsAppSignatureGuard);
    });
  });
});
