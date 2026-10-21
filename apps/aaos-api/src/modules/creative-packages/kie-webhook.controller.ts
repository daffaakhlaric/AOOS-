import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";

import { KieWebhookBodySchema, type KieWebhookBodyDto } from "./dto/kie-webhook.dto.js";
import { KieWebhookSecretGuard } from "./guards/kie-webhook-secret.guard.js";
import { KieWebhookService, type KieWebhookResult } from "./kie-webhook.service.js";

/**
 * PROMPT 53 — KIE WEBHOOK (Phase 41). `POST /api/v1/creative-packages/webhooks/kie` — this
 * route's full path is the SAME literal string `to-creative-connector-config.ts`'s
 * `KIE_WEBHOOK_PATH` constant hands Kie AI as `callBackUrl` (see that file's own doc). Guarded by
 * `KieWebhookSecretGuard` (query-param shared secret — the real, honest substitute for Meta-style
 * HMAC signature verification, which Kie AI's real API does not support; see that guard's own doc).
 *
 * Mirrors `WebhookController`/`WhatsAppWebhookController`'s structure: a thin controller
 * (auth guard + body validation) delegating to a service, `@HttpCode(200)` always on success (Kie
 * AI, like Meta, should never be given a reason to retry a callback this app already understood).
 *
 * The body is validated against `KieWebhookBodySchema` — malformed JSON or a body missing the one
 * real field this handler needs (`data.taskId`) is rejected by `ZodValidationPipe` (→ `ValidationError`
 * → `AaosExceptionFilter`'s existing 422 mapping) BEFORE reaching `KieWebhookService` at all, so
 * that service can assume `body.data.taskId` is always a real, non-empty string.
 */
@Controller("api/v1/creative-packages/webhooks/kie")
@UseGuards(KieWebhookSecretGuard)
export class KieWebhookController {
  constructor(private readonly service: KieWebhookService) {}

  @Post()
  @HttpCode(200)
  receive(
    @Body(new ZodValidationPipe(KieWebhookBodySchema)) body: KieWebhookBodyDto,
    @CorrelationId() correlationId: string,
  ): Promise<KieWebhookResult> {
    return this.service.handleCallback(body, correlationId);
  }
}
