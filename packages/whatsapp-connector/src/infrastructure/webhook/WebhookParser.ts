import { err, ok, type Result } from "@aos/common";

import type { IMessageWebhookParser } from "../../contracts/IMessageWebhookParser.js";
import { PayloadParseError, type WebhookError } from "../../domain/errors/index.js";
import { WaWebhookPayloadSchema, type WaWebhookPayload } from "../../types/WhatsAppWebhookTypes.js";

/**
 * Parses+Zod-validates a raw WhatsApp webhook request body into a typed `WaWebhookPayload`.
 * Mapping that raw payload into domain `IncomingMessage`/status-update events is
 * `mappers/IncomingMessageMapper.ts` and `mappers/MessageStatusMapper.ts`'s job — this class's
 * only responsibility is "is this valid JSON matching Meta's webhook shape".
 */
export class WebhookParser implements IMessageWebhookParser {
  parse(rawBody: string): Result<WaWebhookPayload, WebhookError> {
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch (cause) {
      // `JSON.parse` always throws a `SyntaxError` (an `Error`) on malformed input — the
      // `String(cause)` fallback arm is defensive-only and never reachable in practice.
      /* v8 ignore next */
      return err(
        new PayloadParseError(
          `Webhook body is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        ),
      );
    }

    const parsed = WaWebhookPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new PayloadParseError("Webhook body failed schema validation", {
          context: {
            issues: parsed.error.issues.map(
              (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
            ),
          },
        }),
      );
    }

    return ok(parsed.data);
  }
}
