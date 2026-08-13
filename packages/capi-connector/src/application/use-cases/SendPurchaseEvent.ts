import type { Result } from "@aos/common";

import type { EventResult } from "../../domain/entities/EventResult.js";
import type { CapiError } from "../../domain/errors/CapiError.js";
import type { CapiEventService, SendPurchaseInput } from "../services/CapiEventService.js";

export type SendPurchaseEventInput = SendPurchaseInput;

/** `ClosingRecorded` (`SPK`) -> Meta CAPI `Purchase` event, with `custom_data.value` = the sale's `unitPrice` (IDR), never `commissionIdr` (coordinator note #4). */
export class SendPurchaseEvent {
  constructor(private readonly capiEventService: CapiEventService) {}

  async execute(input: SendPurchaseEventInput): Promise<Result<EventResult, CapiError>> {
    return this.capiEventService.sendPurchase(input);
  }
}
