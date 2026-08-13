import type { Result } from "@aos/common";

import type { EventResult } from "../../domain/entities/EventResult.js";
import type { CapiError } from "../../domain/errors/CapiError.js";
import type { CapiEventService, SendEventInput } from "../services/CapiEventService.js";

export type SendContactEventInput = SendEventInput;

/** `LeadCreated` -> Meta CAPI `Contact` event (spec "AAOS Event -> Meta Event Mapping"). */
export class SendContactEvent {
  constructor(private readonly capiEventService: CapiEventService) {}

  async execute(input: SendContactEventInput): Promise<Result<EventResult, CapiError>> {
    return this.capiEventService.sendContact(input);
  }
}
