import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { ApiServerError, type WhatsAppApiError } from "../../domain/errors/index.js";
import {
  WaSendMessageResponseSchema,
  type WaSendMessageResponse,
} from "../../types/WhatsAppApiTypes.js";

/** Zod-validates a raw WhatsApp Cloud API JSON response body into a typed `WaSendMessageResponse`. */
export class ApiResponseMapper {
  static toSendMessageResponse(json: unknown): Result<WaSendMessageResponse, WhatsAppApiError> {
    const parsed = WaSendMessageResponseSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new ApiServerError("WhatsApp Cloud API response failed schema validation", {
          cause: new ValidationError("WhatsApp Cloud API response failed schema validation", {
            context: { zodError: parsed.error },
          }),
        }),
      );
    }
    return ok(parsed.data);
  }
}
