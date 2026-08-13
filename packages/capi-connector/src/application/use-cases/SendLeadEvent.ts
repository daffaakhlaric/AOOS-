import type { Result } from "@aos/common";

import type { EventResult } from "../../domain/entities/EventResult.js";
import type { CapiError } from "../../domain/errors/CapiError.js";
import type { CapiEventService, SendLeadInput } from "../services/CapiEventService.js";

export type SendLeadEventInput = SendLeadInput;

/** `ClosingRecorded` (`TEST_DRIVE`) -> Meta CAPI `Lead` event (spec "AAOS Event -> Meta Event Mapping"). */
export class SendLeadEvent {
  constructor(private readonly capiEventService: CapiEventService) {}

  async execute(input: SendLeadEventInput): Promise<Result<EventResult, CapiError>> {
    return this.capiEventService.sendLead(input);
  }
}
