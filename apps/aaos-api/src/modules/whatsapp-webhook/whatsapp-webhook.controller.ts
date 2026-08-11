import { Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { CorrelationId } from "../../common/correlation.js";

import {
  WhatsAppSignatureGuard,
  type RequestWithRawBody,
} from "./guards/whatsapp-signature.guard.js";
import { WhatsAppWebhookService } from "./whatsapp-webhook.service.js";

export interface WhatsAppWebhookReceivedResponse {
  readonly received: true;
}

/**
 * `GET /webhooks/whatsapp` — `hub.verify_token` subscription handshake, no auth (mirrors
 * `WebhookController`'s (Meta) GET handler exactly: 200 + challenge on success, 403 + message on
 * a token mismatch — the handshake is not subject to Meta's 20s-retry-on-non-200 pressure, only
 * the POST message-delivery endpoint below is).
 *
 * `POST /webhooks/whatsapp` — inbound message/status delivery. Per the spec's "Critical: Always
 * Return 200" rule: kicks off `ProcessIncomingWebhook` fire-and-forget and returns
 * `{ received: true }` (implicit 200) immediately, regardless of how that processing turns out.
 * `WhatsAppSignatureGuard` is still applied for edge-level signature observability but never
 * blocks the request — see its class doc.
 */
@Controller("webhooks/whatsapp")
export class WhatsAppWebhookController {
  constructor(private readonly whatsAppWebhookService: WhatsAppWebhookService) {}

  @Get()
  handshake(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") token: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
    @Res() reply: FastifyReply,
  ): void {
    const result = this.whatsAppWebhookService.verifyHandshake(mode, token, challenge);
    if (result.ok) {
      void reply.status(200).type("text/plain").send(result.value);
      return;
    }
    void reply.status(403).type("text/plain").send(result.error.message);
  }

  @Post()
  @HttpCode(200)
  @UseGuards(WhatsAppSignatureGuard)
  handleWebhook(
    @Req() request: RequestWithRawBody,
    @CorrelationId() correlationId: string,
  ): WhatsAppWebhookReceivedResponse {
    const signatureHeader = request.headers["x-hub-signature-256"];
    const signature = typeof signatureHeader === "string" ? signatureHeader : undefined;
    const rawBody = request.rawBody !== undefined ? request.rawBody.toString("utf8") : "";

    // Fire-and-forget — never awaited, never lets a processing failure affect this response.
    this.whatsAppWebhookService
      .processIncomingWebhookAsync(rawBody, signature, correlationId)
      .catch(() => {
        // `ProcessIncomingWebhook` already logs every failure mode internally (signature,
        // payload parsing, per-value mapping). Nothing further to do here — this catch exists
        // only to prevent an unhandled promise rejection, per the spec's own code sample.
      });

    return { received: true };
  }
}
