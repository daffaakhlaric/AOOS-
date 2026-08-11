import "reflect-metadata";

import { err, ok } from "@aos/common";
import { TokenVerificationError } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { buildFakeReply } from "../../test-support/nest-mocks.js";

import { WebhookSignatureGuard } from "./guards/webhook-signature.guard.js";
import { WebhookController } from "./webhook.controller.js";
import type { WebhookService } from "./webhook.service.js";

function buildFakeService(): WebhookService {
  return {
    verifyHandshake: vi.fn(),
    processLeadWebhook: vi.fn(async () => ({ received: true as const })),
  } as unknown as WebhookService;
}

describe("WebhookController", () => {
  describe("GET /webhooks/meta (handshake)", () => {
    it("responds 200 with the plain-text challenge on success", () => {
      const service = buildFakeService();
      (service.verifyHandshake as ReturnType<typeof vi.fn>).mockReturnValue(ok("challenge-abc"));
      const controller = new WebhookController(service);
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
      const controller = new WebhookController(service);
      const reply = buildFakeReply();

      controller.handshake("subscribe", "wrong-token", "challenge-abc", reply as never);

      expect(reply.statusCode).toBe(403);
      expect(reply.body[0]).toBe("bad token");
    });
  });

  describe("POST /webhooks/meta (receiveLead)", () => {
    it("delegates to WebhookService.processLeadWebhook with the raw body, signature, and correlation id", async () => {
      const service = buildFakeService();
      const controller = new WebhookController(service);
      const rawBody = Buffer.from('{"object":"page","entry":[]}', "utf8");
      const request = {
        headers: { "x-hub-signature-256": "sha256=abc" },
        rawBody,
      } as never;

      const result = await controller.receiveLead(request, "corr-1");

      expect(service.processLeadWebhook).toHaveBeenCalledWith(
        '{"object":"page","entry":[]}',
        "sha256=abc",
        "corr-1",
      );
      expect(result).toEqual({ received: true });
    });

    it("passes an empty string body when rawBody is missing", async () => {
      const service = buildFakeService();
      const controller = new WebhookController(service);
      const request = { headers: {} } as never;

      await controller.receiveLead(request, "corr-2");

      expect(service.processLeadWebhook).toHaveBeenCalledWith("", undefined, "corr-2");
    });

    it("guards the receiveLead handler with WebhookSignatureGuard", () => {
      const service = buildFakeService();
      const controller = new WebhookController(service);
      const guards = Reflect.getMetadata("__guards__", controller.receiveLead) as unknown[];
      expect(guards).toContain(WebhookSignatureGuard);
    });
  });
});
