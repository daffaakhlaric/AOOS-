import { Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { CorrelationId } from "../../common/correlation.js";

import {
  WebhookSignatureGuard,
  type RequestWithRawBody,
} from "./guards/webhook-signature.guard.js";
import type { WebhookReceivedResponse } from "./webhook.service.js";
import { WebhookService } from "./webhook.service.js";

/**
 * `GET /webhooks/meta` — Meta's `hub.verify_token` subscription handshake, no auth.
 * `POST /webhooks/meta` — inbound lead delivery, guarded by `WebhookSignatureGuard`.
 */
@Controller("webhooks/meta")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  async handshake(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") token: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.webhookService.verifyHandshake(mode, token, challenge);
    if (result.ok) {
      void reply.status(200).type("text/plain").send(result.value);
      return;
    }
    void reply.status(403).type("text/plain").send(result.error.message);
  }

  @Post()
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  async receiveLead(
    @Req() request: RequestWithRawBody,
    @CorrelationId() correlationId: string,
  ): Promise<WebhookReceivedResponse> {
    const signatureHeader = request.headers["x-hub-signature-256"];
    const signature = typeof signatureHeader === "string" ? signatureHeader : undefined;
    const rawBody = request.rawBody !== undefined ? request.rawBody.toString("utf8") : "";
    return this.webhookService.processLeadWebhook(rawBody, signature, correlationId);
  }
}
