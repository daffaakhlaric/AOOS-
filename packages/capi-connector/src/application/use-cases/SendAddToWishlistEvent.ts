import type { Result } from "@aos/common";

import type { EventResult } from "../../domain/entities/EventResult.js";
import type { CapiError } from "../../domain/errors/CapiError.js";
import type { CapiEventService, SendEventInput } from "../services/CapiEventService.js";

export type SendAddToWishlistEventInput = SendEventInput;

/** `LeadBecameHot` (score >= 65) -> Meta CAPI `AddToWishlist` event (spec "AAOS Event -> Meta Event Mapping"). */
export class SendAddToWishlistEvent {
  constructor(private readonly capiEventService: CapiEventService) {}

  async execute(input: SendAddToWishlistEventInput): Promise<Result<EventResult, CapiError>> {
    return this.capiEventService.sendAddToWishlist(input);
  }
}
