import type { Result } from "@aos/common";

import type { EventResult } from "../../domain/entities/EventResult.js";
import type { CapiError } from "../../domain/errors/CapiError.js";
import type { CapiEventService, SendEventInput } from "../services/CapiEventService.js";

export type SendInitiateCheckoutEventInput = SendEventInput;

/** `ScoreUpdated` (score crosses 30) -> Meta CAPI `InitiateCheckout` event (spec "AAOS Event -> Meta Event Mapping"). */
export class SendInitiateCheckoutEvent {
  constructor(private readonly capiEventService: CapiEventService) {}

  async execute(input: SendInitiateCheckoutEventInput): Promise<Result<EventResult, CapiError>> {
    return this.capiEventService.sendInitiateCheckout(input);
  }
}
